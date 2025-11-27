import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

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
    const { limparAntes = false, checkOnly = false } = await req.json().catch(() => ({ limparAntes: false, checkOnly: false }));

    // Responder rápido em modo de verificação, igual Defensivos
    if (checkOnly) {
      return new Response(
        JSON.stringify({ status: 'online', message: 'API acessível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let deletedCount = 0;
    if (limparAntes) {
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

    // Buscar configurações específicas de fertilizantes na system_config
    const { data: configRows } = await supabaseAdmin
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['api_fertilizantes_url', 'api_fertilizantes_secret', 'api_fertilizantes_cliente_id', 'api_fertilizantes_exp']);

    const configs = Object.fromEntries((configRows || []).map((c: any) => [c.config_key, c.config_value]));
    const EXTERNAL_API_URL = configs.api_fertilizantes_url ?? Deno.env.get('EXTERNAL_API_URL') ?? 'http://200.195.154.187:8001/v1/fertilizantes';
    const EXTERNAL_API_SECRET = configs.api_fertilizantes_secret ?? Deno.env.get('EXTERNAL_API_SECRET') ?? 'Co0p@gr!#0la';
    const CLIENT_ID = configs.api_fertilizantes_cliente_id ?? 'admin';
    const JWT_EXP = configs.api_fertilizantes_exp ?? '1893456000';

    const secret = new TextEncoder().encode(EXTERNAL_API_SECRET);
    const jwt = await new jose.SignJWT({ client_id: CLIENT_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(parseInt(String(JWT_EXP)))
      .sign(secret);

    console.log('Fetching fertilizantes data from external API...');
    const apiResponse = await fetch(EXTERNAL_API_URL, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${jwt}` },
    });

    if (!apiResponse.ok) {
      throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const items = await apiResponse.json();
    console.log(`Fetched ${items.length} items from API`);

    // checkOnly já retorna no começo

    const processedItems = items.map((item: any) => ({
      cod_item: String(item.CODITEM ?? item["COD.ITEM"] ?? item["COD. ITEM"] ?? item.cod_item ?? ''),
      item: normalizeProductName(item.ITEM ?? item.item ?? ''),
      grupo: (item.GRUPO ?? item.grupo ?? null),
      marca: (item.MARCA ?? item.marca ?? null),
      principio_ativo: item.PRINCIPIO_ATIVO ?? item["PRINCIPIO ATIVO"] ?? item["PRINCÍPIO ATIVO"] ?? item.principio_ativo ?? null,
      saldo: Number((item.SALDO ?? item.saldo ?? 0) as number),
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
