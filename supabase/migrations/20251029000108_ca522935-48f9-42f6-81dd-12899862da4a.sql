-- Adicionar coluna area_hectares na tabela aplicacoes_defensivos
ALTER TABLE public.aplicacoes_defensivos
ADD COLUMN area_hectares numeric DEFAULT 0;