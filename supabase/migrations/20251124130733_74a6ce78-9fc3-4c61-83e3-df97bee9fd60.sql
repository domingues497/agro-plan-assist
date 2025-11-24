-- Create table for defensivos applied in farm seed treatment
CREATE TABLE IF NOT EXISTS public.programacao_cultivares_defensivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_cultivar_id UUID NOT NULL REFERENCES public.programacao_cultivares(id) ON DELETE CASCADE,
  aplicacao TEXT NOT NULL DEFAULT 'Tratamento de Semente - TS',
  defensivo TEXT NOT NULL,
  dose NUMERIC NOT NULL DEFAULT 0,
  cobertura NUMERIC NOT NULL DEFAULT 100,
  total NUMERIC NOT NULL DEFAULT 0,
  produto_salvo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.programacao_cultivares_defensivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cultivares defensivos"
  ON public.programacao_cultivares_defensivos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.programacao_cultivares pc
      WHERE pc.id = programacao_cultivares_defensivos.programacao_cultivar_id
      AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own cultivares defensivos"
  ON public.programacao_cultivares_defensivos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.programacao_cultivares pc
      WHERE pc.id = programacao_cultivares_defensivos.programacao_cultivar_id
      AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own cultivares defensivos"
  ON public.programacao_cultivares_defensivos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.programacao_cultivares pc
      WHERE pc.id = programacao_cultivares_defensivos.programacao_cultivar_id
      AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own cultivares defensivos"
  ON public.programacao_cultivares_defensivos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.programacao_cultivares pc
      WHERE pc.id = programacao_cultivares_defensivos.programacao_cultivar_id
      AND pc.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.programacao_cultivares_defensivos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add index for better performance
CREATE INDEX idx_programacao_cultivares_defensivos_cultivar_id 
  ON public.programacao_cultivares_defensivos(programacao_cultivar_id);