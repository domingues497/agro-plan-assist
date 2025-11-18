-- Tornar o campo cultura opcional na tabela tratamentos_sementes
ALTER TABLE public.tratamentos_sementes
ALTER COLUMN cultura DROP NOT NULL;