import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limparAntes = false } = await req.json().catch(() => ({ limparAntes: false }));

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limpeza opcional
    let deletedRecords = 0;
    if (limparAntes) {
      const { count } = await supabaseAdmin
        .from('defensivos_catalog')
        .select('*', { count: 'exact', head: true });

      deletedRecords = count || 0;

      const { error: delErr } = await supabaseAdmin
        .from('defensivos_catalog')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) {
        return new Response(
          JSON.stringify({ error: 'Erro ao limpar tabela', details: delErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Chamada à API externa
    const EXTERNAL_API_URL = Deno.env.get('EXTERNAL_API_URL') ?? 'http://192.168.0.230:8000/v1/itens';
    const EXTERNAL_API_SECRET = Deno.env.get('EXTERNAL_API_SECRET') ?? 'Co0p@gr!#0la';
    const payload = { client_id: 'admin', exp: 1893456000 };

    const extResp = await fetch(EXTERNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXTERNAL_API_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!extResp.ok) {
      const text = await extResp.text();
      return new Response(
        JSON.stringify({ error: 'Falha ao consultar API externa', status: extResp.status, body: text }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const items = await extResp.json();
    if (!Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: 'Resposta inesperada da API externa' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar e importar
    let imported = 0;
    for (const row of items as any[]) {
      const cod_item = row["COD.ITEM"] ?? row["COD. ITEM"] ?? row["cod_item"] ?? row["codigo"] ?? null;
      const item = row["ITEM"] ?? row["item"] ?? null;
      const grupo = (row["GRUPO"] ?? row["grupo"] ?? null);
      const marca = (row["MARCA"] ?? row["marca"] ?? null);
      const principio_ativo = row["PRINCIPIO_ATIVO"] ?? row["PRINCIPIO ATIVO"] ?? row["PRINCÍPIO ATIVO"] ?? row["principio_ativo"] ?? null;

      if (!cod_item && !item) continue; // ignorar linhas inválidas

      const defensivoData = {
        cod_item: cod_item ?? null,
        item: normalizeProductName(item),
        grupo: grupo ? String(grupo).toUpperCase().trim() : null,
        marca: marca ? String(marca).toUpperCase().trim() : null,
        principio_ativo: principio_ativo ? String(principio_ativo).toUpperCase().trim() : null,
      };

      const { error } = await supabaseAdmin
        .from('defensivos_catalog')
        .upsert(defensivoData, { onConflict: 'cod_item', ignoreDuplicates: false });

      if (!error) {
        imported++;
      } else {
        console.error('Erro ao importar defensivo:', error.message);
      }
    }

    // Registrar histórico
    await supabaseAdmin.from('import_history').insert({
      user_id: user.id,
      tabela_nome: 'defensivos_catalog',
      registros_importados: imported,
      registros_deletados: deletedRecords,
      arquivo_nome: 'API externa',
      limpar_antes: limparAntes,
    });

    return new Response(
      JSON.stringify({ success: true, imported, deleted: deletedRecords }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

