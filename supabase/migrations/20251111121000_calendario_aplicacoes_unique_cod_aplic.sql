-- Garantir índice único para permitir upsert com onConflict em cod_aplic
-- Corrige erro: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- Remover duplicatas (mantém o menor id por cod_aplic) antes de criar índice único
WITH dups AS (
  SELECT cod_aplic, MIN(id) AS keep_id
  FROM public.calendario_aplicacoes
  WHERE cod_aplic IS NOT NULL AND cod_aplic <> ''
  GROUP BY cod_aplic
), to_delete AS (
  SELECT c.id
  FROM public.calendario_aplicacoes c
  JOIN dups d ON c.cod_aplic = d.cod_aplic
  WHERE c.id <> d.keep_id
)
DELETE FROM public.calendario_aplicacoes WHERE id IN (SELECT id FROM to_delete);

-- Criar índice único para suportar o upsert com onConflict
CREATE UNIQUE INDEX IF NOT EXISTS calendario_aplicacoes_cod_aplic_key
  ON public.calendario_aplicacoes (cod_aplic);