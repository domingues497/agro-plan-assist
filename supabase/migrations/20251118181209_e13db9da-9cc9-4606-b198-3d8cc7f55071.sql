-- Adiciona coluna classe em programacao_defensivos
ALTER TABLE public.programacao_defensivos 
  ADD COLUMN IF NOT EXISTS classe text;

-- Backfill: preenche classe baseado no alvo quando há match exato com calendario_aplicacoes
UPDATE public.programacao_defensivos pd
SET classe = ca.descricao_classe
FROM public.calendario_aplicacoes ca
WHERE pd.classe IS NULL 
  AND pd.alvo IS NOT NULL 
  AND lower(pd.alvo) = lower(ca.descr_aplicacao);

-- Índice opcional para melhorar performance de queries
CREATE INDEX IF NOT EXISTS programacao_defensivos_aplicacao_classe_idx 
  ON public.programacao_defensivos (aplicacao_id, classe);