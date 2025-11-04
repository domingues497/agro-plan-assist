-- Criar tabela de profiles para vincular usuários a consultores
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  numerocm_consultor TEXT,
  nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Função para obter numerocm_consultor do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_consultor()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT numerocm_consultor
  FROM public.profiles
  WHERE user_id = auth.uid()
$$;

-- Atualizar políticas de produtores para restringir por consultor
DROP POLICY IF EXISTS "Anyone can view produtores" ON public.produtores;

CREATE POLICY "Consultores can view own produtores"
  ON public.produtores
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR numerocm_consultor = public.get_user_consultor()
  );

-- Atualizar políticas de fazendas para restringir por consultor
DROP POLICY IF EXISTS "Anyone can view fazendas" ON public.fazendas;

CREATE POLICY "Consultores can view own fazendas"
  ON public.fazendas
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR numerocm_consultor = public.get_user_consultor()
  );