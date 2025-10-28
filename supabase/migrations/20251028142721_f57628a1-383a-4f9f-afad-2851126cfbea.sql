-- Criar tabela de fazendas
CREATE TABLE public.fazendas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numerocm text NOT NULL,
  idfazenda text NOT NULL,
  nomefazenda text NOT NULL,
  numerocm_consultor text NOT NULL,
  area_cultivavel numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(numerocm, idfazenda)
);

-- Habilitar RLS
ALTER TABLE public.fazendas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage fazendas"
ON public.fazendas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view fazendas"
ON public.fazendas
FOR SELECT
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_fazendas_updated_at
BEFORE UPDATE ON public.fazendas
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();