-- Add populacao_recomendada and sementes_por_saca columns to programacao_cultivares
ALTER TABLE public.programacao_cultivares 
ADD COLUMN IF NOT EXISTS populacao_recomendada numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sementes_por_saca numeric DEFAULT 0;