-- Criar tabela de safras
CREATE TABLE public.safras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  ativa boolean NOT NULL DEFAULT true,
  ano_inicio integer,
  ano_fim integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.safras ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para safras
CREATE POLICY "Anyone can view active safras"
ON public.safras
FOR SELECT
USING (ativa = true);

CREATE POLICY "Admins can manage safras"
ON public.safras
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_safras_updated_at
BEFORE UPDATE ON public.safras
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Adicionar campo safra_id nas tabelas de programação (referência à tabela safras)
ALTER TABLE public.programacao_adubacao
ADD COLUMN safra_id uuid REFERENCES public.safras(id);

ALTER TABLE public.programacao_defensivos
ADD COLUMN safra_id uuid REFERENCES public.programacao_defensivos(id);

-- Inserir safra padrão
INSERT INTO public.safras (nome, is_default, ano_inicio, ano_fim)
VALUES ('2024/2025', true, 2024, 2025);