-- Adiciona coluna produtor_numerocm nas tabelas de programação
ALTER TABLE public.programacao_cultivares 
ADD COLUMN produtor_numerocm text;

ALTER TABLE public.programacao_adubacao 
ADD COLUMN produtor_numerocm text;

ALTER TABLE public.programacao_defensivos 
ADD COLUMN produtor_numerocm text;