-- Adicionar campo ativo na tabela profiles para permitir inativar usuários
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Criar índice para melhor performance nas consultas de usuários ativos
CREATE INDEX IF NOT EXISTS idx_profiles_ativo ON public.profiles(ativo);

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.ativo IS 'Flag que indica se o usuário está ativo no sistema';