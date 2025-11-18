-- Criar tabela para relacionar cultivares com tratamentos
CREATE TABLE IF NOT EXISTS public.cultivares_tratamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cultivar_cod_item text NOT NULL REFERENCES public.cultivares_catalog(cod_item) ON DELETE CASCADE,
  tratamento_id uuid NOT NULL REFERENCES public.tratamentos_sementes(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(cultivar_cod_item, tratamento_id)
);

-- Habilitar RLS
ALTER TABLE public.cultivares_tratamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage cultivares_tratamentos"
  ON public.cultivares_tratamentos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view cultivares_tratamentos"
  ON public.cultivares_tratamentos
  FOR SELECT
  USING (true);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS cultivares_tratamentos_cultivar_idx 
  ON public.cultivares_tratamentos(cultivar_cod_item);
  
CREATE INDEX IF NOT EXISTS cultivares_tratamentos_tratamento_idx 
  ON public.cultivares_tratamentos(tratamento_id);