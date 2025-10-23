-- Fix function search_path for security
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_programacao_cultivares_updated_at
  BEFORE UPDATE ON public.programacao_cultivares
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_programacao_adubacao_updated_at
  BEFORE UPDATE ON public.programacao_adubacao
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_programacao_defensivos_updated_at
  BEFORE UPDATE ON public.programacao_defensivos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();