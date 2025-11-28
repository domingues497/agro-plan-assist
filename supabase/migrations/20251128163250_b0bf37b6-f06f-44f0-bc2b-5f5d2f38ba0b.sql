-- Drop existing policies on produtores
DROP POLICY IF EXISTS "Users can view produtores by role" ON public.produtores;
DROP POLICY IF EXISTS "Admins can manage produtores" ON public.produtores;

-- Recreate policies with email fallback for consultores

-- Admin policy
CREATE POLICY "Admins can manage produtores"
ON public.produtores
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- SELECT policy with email fallback
CREATE POLICY "Users can view produtores by role"
ON public.produtores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'consultor'::app_role) 
    AND (
      numerocm_consultor = get_user_consultor()
      OR EXISTS (
        SELECT 1 
        FROM public.consultores 
        WHERE consultores.numerocm_consultor = produtores.numerocm_consultor 
        AND consultores.email = (auth.jwt()->>'email')
      )
    )
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role) 
    AND numerocm IN (
      SELECT produtor_numerocm 
      FROM public.user_produtores 
      WHERE user_id = auth.uid()
    )
  )
);