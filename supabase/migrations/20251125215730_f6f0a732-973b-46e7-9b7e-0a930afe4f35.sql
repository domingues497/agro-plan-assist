-- Criar tabela de talhões
CREATE TABLE public.talhoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fazenda_id UUID NOT NULL,
  nome TEXT NOT NULL,
  area NUMERIC NOT NULL CHECK (area > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_fazenda FOREIGN KEY (fazenda_id) REFERENCES public.fazendas(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.talhoes ENABLE ROW LEVEL SECURITY;

-- RLS policies for talhoes
CREATE POLICY "Admins can manage talhoes"
ON public.talhoes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Consultores can manage own talhoes"
ON public.talhoes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fazendas f
    WHERE f.id = talhoes.fazenda_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR f.numerocm_consultor = get_user_consultor()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fazendas f
    WHERE f.id = talhoes.fazenda_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR f.numerocm_consultor = get_user_consultor()
    )
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_talhoes_updated_at
BEFORE UPDATE ON public.talhoes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Criar tabela de junção para programações e talhões
CREATE TABLE public.programacao_talhoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programacao_id UUID NOT NULL,
  talhao_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_programacao FOREIGN KEY (programacao_id) REFERENCES public.programacoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_talhao FOREIGN KEY (talhao_id) REFERENCES public.talhoes(id) ON DELETE CASCADE,
  UNIQUE(programacao_id, talhao_id)
);

-- Enable RLS
ALTER TABLE public.programacao_talhoes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own programacao_talhoes"
ON public.programacao_talhoes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.programacoes p
    WHERE p.id = programacao_talhoes.programacao_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.programacoes p
    WHERE p.id = programacao_talhoes.programacao_id
    AND p.user_id = auth.uid()
  )
);

-- Remover coluna area_cultivavel da tabela fazendas
ALTER TABLE public.fazendas DROP COLUMN IF EXISTS area_cultivavel;

-- Criar função para calcular área cultivável de uma fazenda
CREATE OR REPLACE FUNCTION public.get_fazenda_area_cultivavel(fazenda_uuid UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(area), 0)
  FROM public.talhoes
  WHERE fazenda_id = fazenda_uuid;
$$;

-- Criar função para calcular área total de uma programação
CREATE OR REPLACE FUNCTION public.get_programacao_area_total(programacao_uuid UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(t.area), 0)
  FROM public.programacao_talhoes pt
  JOIN public.talhoes t ON t.id = pt.talhao_id
  WHERE pt.programacao_id = programacao_uuid;
$$;