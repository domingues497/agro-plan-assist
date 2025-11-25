import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://deno.land/x/jose@v5.9.6/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normaliza o nome do produto removendo termos de embalagem
 */
function normalizeProductName(text: string | null | undefined): string {
  if (!text) return "";
  
  let normalized = text.toUpperCase().trim().replace(/\s+/g, " ");
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
    console.log('🚀 [SALDO SYNC] Iniciando sincronização automática de saldo');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configurações da API
    console.log('📖 [CONFIG] Buscando configurações da API');
    const { data: configs, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('config_key, config_value')
      .in('config_key', ['api_defensivos_url', 'api_defensivos_secret', 'api_defensivos_client_id', 'api_defensivos_exp']);

    if (configError) {
      console.error('❌ [CONFIG] Erro ao buscar configurações:', configError);
      throw new Error(`Erro ao buscar configurações: ${configError.message}`);
    }

    const configMap = configs.reduce((acc, { config_key, config_value }) => {
      acc[config_key] = config_value;
      return acc;
    }, {} as Record<string, string>);

    const EXTERNAL_API_URL = configMap['api_defensivos_url'];
    const SECRET = configMap['api_defensivos_secret'];
    const CLIENT_ID = configMap['api_defensivos_client_id'];
    const JWT_EXP = configMap['api_defensivos_exp'];

    if (!EXTERNAL_API_URL || !SECRET || !CLIENT_ID || !JWT_EXP) {
      throw new Error('Configurações da API incompletas');
    }

    // Gerar JWT
    console.log('🔐 [AUTH] Gerando token JWT para API externa');
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(SECRET);
    
    const jwt = await new SignJWT({ client_id: CLIENT_ID })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(JWT_EXP)
      .sign(secretKey);

    // Buscar dados da API
    console.log('🌐 [API] Consultando API externa:', EXTERNAL_API_URL);
    const startTime = Date.now();
    
    const response = await fetch(EXTERNAL_API_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`⏱️ [API] Tempo de resposta: ${elapsedTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [API] Falha na requisição - Status: ${response.status} ${errorText}`);
      throw new Error(`Falha na API: ${response.status}`);
    }

    const apiData = await response.json();
    console.log(`📦 [API] ${apiData.length} itens recebidos da API externa`);

    // Processar itens
    console.log('🔄 [SYNC] Iniciando sincronização de saldo');
    let updated = 0;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < apiData.length; i++) {
      const item = apiData[i];
      
      try {
        const normalizedItem = normalizeProductName(item.item);
        
        // Buscar produto existente pelo item normalizado
        const { data: existing } = await supabaseAdmin
          .from('defensivos_catalog')
          .select('id')
          .eq('item', normalizedItem)
          .single();

        if (existing) {
          // Atualizar saldo
          const { error: updateError } = await supabaseAdmin
            .from('defensivos_catalog')
            .update({ 
              saldo: item.saldo || 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`❌ [UPDATE] Erro ao atualizar ${normalizedItem}:`, updateError);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Inserir novo produto
          const { error: insertError } = await supabaseAdmin
            .from('defensivos_catalog')
            .insert({
              cod_item: item.cod_item,
              item: normalizedItem,
              grupo: item.grupo,
              marca: item.marca,
              principio_ativo: item.principio_ativo,
              saldo: item.saldo || 0,
            });

          if (insertError) {
            console.error(`❌ [INSERT] Erro ao inserir ${normalizedItem}:`, insertError);
            errors++;
          } else {
            inserted++;
          }
        }

        // Log de progresso a cada 100 itens
        if ((i + 1) % 100 === 0) {
          console.log(`📊 [PROGRESS] ${i + 1}/${apiData.length} processados`);
        }
      } catch (itemError) {
        console.error(`❌ [ITEM] Erro ao processar item:`, itemError);
        errors++;
      }
    }

    console.log(`✅ [SYNC] Concluído: ${updated} atualizados, ${inserted} inseridos, ${errors} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        inserted,
        errors,
        total: apiData.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [ERROR] Erro na sincronização:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
