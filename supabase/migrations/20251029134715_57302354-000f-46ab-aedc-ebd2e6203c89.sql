-- Add area_hectares column to programacao_cultivares
ALTER TABLE public.programacao_cultivares 
ADD COLUMN IF NOT EXISTS area_hectares numeric DEFAULT 0;