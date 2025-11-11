-- Remover duplicatas (mantém o registro mais antigo por cod_aplic)
DELETE FROM public.calendario_aplicacoes ca1
WHERE ca1.id NOT IN (
  SELECT DISTINCT ON (cod_aplic) id
  FROM public.calendario_aplicacoes
  WHERE cod_aplic IS NOT NULL AND cod_aplic <> ''
  ORDER BY cod_aplic, created_at ASC
);

-- Criar índice único para suportar o upsert com onConflict
CREATE UNIQUE INDEX IF NOT EXISTS calendario_aplicacoes_cod_aplic_key
  ON public.calendario_aplicacoes (cod_aplic);