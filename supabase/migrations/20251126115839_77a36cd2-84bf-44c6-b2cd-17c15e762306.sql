-- Create epocas table
CREATE TABLE public.epocas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.epocas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage epocas" 
ON public.epocas 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active epocas" 
ON public.epocas 
FOR SELECT 
USING (ativa = true);

-- Add epoca_id to programacao_cultivares
ALTER TABLE public.programacao_cultivares 
ADD COLUMN epoca_id UUID REFERENCES public.epocas(id);

-- Create trigger for updated_at
CREATE TRIGGER update_epocas_updated_at
BEFORE UPDATE ON public.epocas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();