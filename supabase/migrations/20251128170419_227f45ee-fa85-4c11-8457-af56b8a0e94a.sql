-- Remover campo obsoleto numerocm_consultor_gestor da tabela profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS numerocm_consultor_gestor;

-- Nota: Mantemos as tabelas user_produtores e user_fazendas por enquanto para 
-- compatibilidade, mas elas não são mais utilizadas pelo sistema