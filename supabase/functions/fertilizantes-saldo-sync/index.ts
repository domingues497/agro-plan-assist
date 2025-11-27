import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SignJWT } from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'external_api_url')
      .single();

    if (configError || !configData) {
      throw new Error('External API URL not configured');
    }

    const EXTERNAL_API_URL = configData.config_value;
    const EXTERNAL_API_SECRET = Deno.env.get('EXTERNAL_API_SECRET');

    if (!EXTERNAL_API_SECRET) {
      throw new Error('External API secret not configured');
    }

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(EXTERNAL_API_SECRET));

    console.log('Fetching fertilizantes saldo from external API...');
    const apiResponse = await fetch(`${EXTERNAL_API_URL}/fertilizantes`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const items = await apiResponse.json();
    console.log(`Fetched ${items.length} items from API`);

    let updated = 0;
    let inserted = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const codItem = String(item.CODITEM || '');
        const saldo = Number(item.SALDO || 0);

        const { data: existing } = await supabaseAdmin
          .from('fertilizantes_catalog')
          .select('id')
          .eq('cod_item', codItem)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabaseAdmin
            .from('fertilizantes_catalog')
            .update({
              saldo,
              updated_at: new Date().toISOString(),
            })
            .eq('cod_item', codItem);

          if (updateError) {
            console.error(`Error updating ${codItem}:`, updateError);
            errors++;
          } else {
            updated++;
          }
        } else {
          const { error: insertError } = await supabaseAdmin
            .from('fertilizantes_catalog')
            .insert({
              cod_item: codItem,
              item: item.ITEM || null,
              grupo: item.GRUPO || null,
              marca: item.MARCA || null,
              principio_ativo: item.PRINCIPIO_ATIVO || null,
              saldo,
            });

          if (insertError) {
            console.error(`Error inserting ${codItem}:`, insertError);
            errors++;
          } else {
            inserted++;
          }
        }
      } catch (itemError) {
        console.error('Error processing item:', itemError);
        errors++;
      }
    }

    console.log(`Sync completed: ${updated} updated, ${inserted} inserted, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Saldo synchronized successfully',
        updated,
        inserted,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fertilizantes-saldo-sync:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
