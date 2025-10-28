-- Cria tabela de aplicações de defensivos (contexto geral)
CREATE TABLE public.aplicacoes_defensivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  produtor_numerocm TEXT,
  area TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aplicacoes_defensivos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own aplicacoes"
ON public.aplicacoes_defensivos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aplicacoes"
ON public.aplicacoes_defensivos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aplicacoes"
ON public.aplicacoes_defensivos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own aplicacoes"
ON public.aplicacoes_defensivos
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_aplicacoes_defensivos_updated_at
BEFORE UPDATE ON public.aplicacoes_defensivos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Modifica tabela programacao_defensivos para ser "filha" de aplicacoes_defensivos
ALTER TABLE public.programacao_defensivos
ADD COLUMN aplicacao_id UUID REFERENCES public.aplicacoes_defensivos(id) ON DELETE CASCADE;

-- Remove colunas que agora estão na tabela pai
ALTER TABLE public.programacao_defensivos
DROP COLUMN IF EXISTS produtor_numerocm,
DROP COLUMN IF EXISTS area,
DROP COLUMN IF EXISTS data_aplicacao;