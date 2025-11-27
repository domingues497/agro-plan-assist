-- Cria índice único para garantir idempotência de upsert por (cultivar, cultura)
-- Permite múltiplos NULL em cultura (comportamento padrão do UNIQUE em Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS cultivars_catalog_unique_cultivar_cultura
ON public.cultivares_catalog (cultivar, cultura);

-- Opcional: remover duplicatas exatas antes de criar o índice (executar manualmente caso necessário)
-- DELETE FROM public.cultivares_catalog a
-- USING public.cultivares_catalog b
-- WHERE a.ctid < b.ctid
--   AND a.cultivar = b.cultivar
--   AND (a.cultura IS NOT DISTINCT FROM b.cultura)
--   AND (a.nome_cientifico IS NOT DISTINCT FROM b.nome_cientifico);
