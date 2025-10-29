-- Remover coluna area_hectares da tabela aplicacoes_defensivos
ALTER TABLE public.aplicacoes_defensivos
DROP COLUMN area_hectares;

-- Adicionar coluna area_hectares na tabela programacao_defensivos
ALTER TABLE public.programacao_defensivos
ADD COLUMN area_hectares numeric DEFAULT 0;