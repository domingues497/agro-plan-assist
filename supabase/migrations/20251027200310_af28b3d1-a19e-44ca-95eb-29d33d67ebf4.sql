-- Create consultores table
CREATE TABLE public.consultores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numerocm_consultor text NOT NULL UNIQUE,
  consultor text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consultores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consultores
CREATE POLICY "Anyone can view consultores"
  ON public.consultores
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage consultores"
  ON public.consultores
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create produtores table
CREATE TABLE public.produtores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numerocm text NOT NULL UNIQUE,
  nome text NOT NULL,
  numerocm_consultor text NOT NULL,
  consultor text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.produtores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for produtores
CREATE POLICY "Anyone can view produtores"
  ON public.produtores
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage produtores"
  ON public.produtores
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_consultores_updated_at
  BEFORE UPDATE ON public.consultores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_produtores_updated_at
  BEFORE UPDATE ON public.produtores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();