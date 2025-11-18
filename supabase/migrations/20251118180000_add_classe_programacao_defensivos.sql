-- Add optional 'classe' column to programacao_defensivos to persist selected class
ALTER TABLE public.programacao_defensivos
  ADD COLUMN IF NOT EXISTS classe text;

-- Try to backfill 'classe' from calendario_aplicacoes when alvo matches exactly (case-insensitive)
UPDATE public.programacao_defensivos pd
SET classe = ca.descricao_classe
FROM public.calendario_aplicacoes ca
WHERE pd.classe IS NULL
  AND pd.alvo IS NOT NULL
  AND lower(pd.alvo) = lower(ca.descr_aplicacao);

-- Optional index to speed up lookups by aplicacao and classe
CREATE INDEX IF NOT EXISTS programacao_defensivos_aplicacao_classe_idx
  ON public.programacao_defensivos (aplicacao_id, classe);