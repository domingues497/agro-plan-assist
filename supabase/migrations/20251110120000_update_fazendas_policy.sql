-- Permitir que consultores atualizem suas próprias fazendas (área cultivável)
-- Mantém admins com permissão total via política existente "Admins can manage fazendas"

-- Evitar duplicidade se já existir alguma política semelhante
DROP POLICY IF EXISTS "Consultores can update own fazendas" ON public.fazendas;

CREATE POLICY "Consultores can update own fazendas"
  ON public.fazendas
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR numerocm_consultor = public.get_user_consultor()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR numerocm_consultor = public.get_user_consultor()
  );