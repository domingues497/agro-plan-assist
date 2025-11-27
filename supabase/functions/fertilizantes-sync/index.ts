import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SignJWT } from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeProductName(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limparAntes = false, checkOnly = false } = await req.json().catch(() => ({}));
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let deletedCount = 0;
    if (limparAntes && !checkOnly) {
      console.log('Clearing existing fertilizantes_catalog data...');
      const { error: deleteError, count } = await supabaseAdmin
        .from('fertilizantes_catalog')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.error('Error deleting data:', deleteError);
        throw deleteError;
      }
      deletedCount = count || 0;
      console.log(`Deleted ${deletedCount} existing records`);
    }

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

    console.log('Fetching fertilizantes data from external API...');
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

    if (checkOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'API connection successful',
          itemCount: items.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processedItems = items.map((item: any) => ({
      cod_item: String(item.CODITEM || ''),
      item: normalizeProductName(item.ITEM),
      grupo: item.GRUPO || null,
      marca: item.MARCA || null,
      principio_ativo: item.PRINCIPIO_ATIVO || null,
      saldo: Number(item.SALDO || 0),
    }));

    const BATCH_SIZE = 500;
    let totalImported = 0;

    for (let i = 0; i < processedItems.length; i += BATCH_SIZE) {
      const batch = processedItems.slice(i, i + BATCH_SIZE);
      console.log(`Importing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(processedItems.length / BATCH_SIZE)}`);

      const { error: insertError } = await supabaseAdmin
        .from('fertilizantes_catalog')
        .upsert(batch, {
          onConflict: 'cod_item',
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.error('Error importing batch:', insertError);
        throw insertError;
      }

      totalImported += batch.length;
    }

    const { error: historyError } = await supabaseAdmin
      .from('import_history')
      .insert({
        user_id: user.id,
        tabela_nome: 'fertilizantes_catalog',
        registros_importados: totalImported,
        registros_deletados: deletedCount,
        limpar_antes: limparAntes,
        arquivo_nome: 'API Sync',
      });

    if (historyError) {
      console.error('Error recording import history:', historyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Fertilizantes synchronized successfully',
        imported: totalImported,
        deleted: deletedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fertilizantes-sync:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
