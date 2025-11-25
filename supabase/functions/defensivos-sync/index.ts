import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalização semelhante ao frontend para nomes de itens
function normalizeProductName(text: string | null | undefined): string {
  if (!text) return "";
  let normalized = String(text).toUpperCase().trim().replace(/\s+/g, " ");
  normalized = normalized.replace(/\s*-?\s*\d+\s*(LT|L|KG|G|ML|SACA|SACAS|BIG\s*BAG|LITRO|LITROS|KILO|KILOS|GRAMAS?)\s*-?\s*/gi, " ");
  normalized = normalized.replace(/\s*-?\s*(BIG\s*BAG|SACA|SACAS|LITRO|LITROS|KILO|KILOS|GRAMAS?)\s*-?\s*/gi, " ");
  normalized = normalized.replace(/\s*-\s*-\s*/g, " - ");
  normalized = normalized.replace(/\s+/g, " ");
  normalized = normalized.replace(/^\s*-\s*|\s*-\s*$/g, "");
  return normalized.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('🚀 [SYNC START] Iniciando sincronização de defensivos');
    
    const { limparAntes = false, checkOnly = false } = await req.json().catch(() => ({ limparAntes: false, checkOnly: false }));
    console.log('📋 [CONFIG] Limpar antes:', limparAntes);

    // Se for apenas verificação de conectividade, retornar sucesso rápido
    if (checkOnly) {
      console.log('🔍 [CHECK] Verificação de conectividade - retornando sucesso');
      return new Response(
        JSON.stringify({ status: 'online', message: 'API acessível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [AUTH] Requisição sem header Authorization');
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('❌ [AUTH] Erro ao obter usuário:', userError?.message);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ [AUTH] Usuário autenticado:', user.email);

    // Limpeza opcional
    let deletedRecords = 0;
    if (limparAntes) {
      console.log('🗑️ [CLEANUP] Iniciando limpeza da tabela');
      const { count } = await supabaseAdmin
        .from('defensivos_catalog')
        .select('*', { count: 'exact', head: true });

      deletedRecords = count || 0;
      console.log(`📊 [CLEANUP] Registros a serem removidos: ${deletedRecords}`);

      const { error: delErr } = await supabaseAdmin
        .from('defensivos_catalog')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) {
        console.error('❌ [CLEANUP] Erro ao limpar tabela:', delErr.message);
        return new Response(
          JSON.stringify({ error: 'Erro ao limpar tabela', details: delErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`✅ [CLEANUP] ${deletedRecords} registros removidos com sucesso`);
    }

    // Buscar configurações da API da tabela system_config
    console.log('📖 [CONFIG] Buscando configurações da API');
    const { data: configData } = await supabaseAdmin
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['api_defensivos_url', 'api_defensivos_secret', 'api_defensivos_client_id', 'api_defensivos_exp']);
    
    const configs = Object.fromEntries(
      (configData || []).map(c => [c.config_key, c.config_value])
    );
    
    const EXTERNAL_API_URL = configs.api_defensivos_url ?? Deno.env.get('EXTERNAL_API_URL') ?? 'http://200.195.154.187:8001/v1/itens';
    const EXTERNAL_API_SECRET = configs.api_defensivos_secret ?? Deno.env.get('EXTERNAL_API_SECRET') ?? 'Co0p@gr!#0la';
    const CLIENT_ID = configs.api_defensivos_client_id ?? 'admin';
    const JWT_EXP = configs.api_defensivos_exp ?? '1893456000';

    console.log('🌐 [API] Consultando API externa:', EXTERNAL_API_URL);
    const apiStartTime = Date.now();

    // Gerar JWT válido para autenticação na API externa
    const secret = new TextEncoder().encode(EXTERNAL_API_SECRET);
    const jwt = await new jose.SignJWT({ client_id: CLIENT_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(parseInt(JWT_EXP))
      .sign(secret);

    console.log('🔐 [AUTH] Token JWT gerado para API externa');

    // API externa usa GET com token JWT
    const extResp = await fetch(EXTERNAL_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const apiDuration = Date.now() - apiStartTime;
    console.log(`⏱️ [API] Tempo de resposta: ${apiDuration}ms`);

    if (!extResp.ok) {
      const text = await extResp.text();
      console.error(`❌ [API] Falha na requisição - Status: ${extResp.status}`, text);
      return new Response(
        JSON.stringify({ error: 'Falha ao consultar API externa', status: extResp.status, body: text }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const items = await extResp.json();
    if (!Array.isArray(items)) {
      console.error('❌ [API] Resposta inválida - não é um array');
      return new Response(
        JSON.stringify({ error: 'Resposta inesperada da API externa' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📦 [API] ${items.length} itens recebidos da API externa`);

    // Processar e importar em lotes
    console.log('🔄 [IMPORT] Iniciando processamento dos itens');
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    const processedItems = [];
    
    for (const row of items as any[]) {
      const cod_item = row["CODITEM"] ?? row["COD.ITEM"] ?? row["COD. ITEM"] ?? row["cod_item"] ?? row["codigo"] ?? null;
      const item = row["ITEM"] ?? row["item"] ?? null;
      const grupo = (row["GRUPO"] ?? row["grupo"] ?? null);
      const marca = (row["MARCA"] ?? row["marca"] ?? null);
      const principio_ativo = row["PRINCIPIO_ATIVO"] ?? row["PRINCIPIO ATIVO"] ?? row["PRINCÍPIO ATIVO"] ?? row["principio_ativo"] ?? null;
      const saldo = row["SALDO"] ?? row["saldo"] ?? row["Saldo"] ?? null;

      if (!cod_item && !item) {
        skipped++;
        continue;
      }

      // Normalizar saldo para número
      let saldoNumerico = 0;
      if (saldo !== null && saldo !== undefined) {
        const saldoParsed = parseFloat(String(saldo).replace(',', '.'));
        saldoNumerico = isNaN(saldoParsed) ? 0 : saldoParsed;
      }

      processedItems.push({
        cod_item: cod_item ?? null,
        item: normalizeProductName(item),
        grupo: grupo ? String(grupo).toUpperCase().trim() : null,
        marca: marca ? String(marca).toUpperCase().trim() : null,
        principio_ativo: principio_ativo ? String(principio_ativo).toUpperCase().trim() : null,
        saldo: saldoNumerico,
      });
    }

    // Importar em lotes de 500
    const batchSize = 500;
    for (let i = 0; i < processedItems.length; i += batchSize) {
      const batch = processedItems.slice(i, i + batchSize);
      
      const { error } = await supabaseAdmin
        .from('defensivos_catalog')
        .upsert(batch, { onConflict: 'cod_item', ignoreDuplicates: false });

      if (!error) {
        imported += batch.length;
        console.log(`📊 [IMPORT] Progresso: ${imported} itens importados`);
      } else {
        errors += batch.length;
        console.error(`❌ [IMPORT] Erro ao importar lote:`, error.message);
      }
    }
    
    console.log(`✅ [IMPORT] Processamento concluído: ${imported} importados, ${skipped} ignorados, ${errors} erros`);

    // Registrar histórico
    console.log('📝 [HISTORY] Registrando histórico da importação');
    await supabaseAdmin.from('import_history').insert({
      user_id: user.id,
      tabela_nome: 'defensivos_catalog',
      registros_importados: imported,
      registros_deletados: deletedRecords,
      arquivo_nome: 'API externa',
      limpar_antes: limparAntes,
    });

    const totalDuration = Date.now() - startTime;
    console.log(`✅ [SYNC END] Sincronização concluída em ${totalDuration}ms`);
    console.log(`📊 [SUMMARY] Importados: ${imported} | Deletados: ${deletedRecords} | Ignorados: ${skipped} | Erros: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, imported, deleted: deletedRecords }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ [ERROR] Erro fatal na sincronização:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

