-- Adicionar coluna saldo na tabela defensivos_catalog
ALTER TABLE public.defensivos_catalog 
ADD COLUMN saldo NUMERIC(10,2) DEFAULT 0;