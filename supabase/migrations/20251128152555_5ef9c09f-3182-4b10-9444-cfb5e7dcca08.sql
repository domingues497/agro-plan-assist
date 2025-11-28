-- Drop existing policies
DROP POLICY IF EXISTS "Users can view fazendas by role" ON public.fazendas;
DROP POLICY IF EXISTS "Consultores and gestores can update fazendas" ON public.fazendas;
DROP POLICY IF EXISTS "Admins can manage fazendas" ON public.fazendas;

-- Recreate policies with email fallback for consultores

-- Admin policy
CREATE POLICY "Admins can manage fazendas"
ON public.fazendas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- SELECT policy with email fallback
CREATE POLICY "Users can view fazendas by role"
ON public.fazendas
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
        WHERE consultores.numerocm_consultor = fazendas.numerocm_consultor 
        AND consultores.email = (auth.jwt()->>'email')
      )
    )
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role) 
    AND id IN (
      SELECT fazenda_id 
      FROM public.user_fazendas 
      WHERE user_id = auth.uid()
    )
  )
);

-- UPDATE policy with email fallback
CREATE POLICY "Consultores and gestores can update fazendas"
ON public.fazendas
FOR UPDATE
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
        WHERE consultores.numerocm_consultor = fazendas.numerocm_consultor 
        AND consultores.email = (auth.jwt()->>'email')
      )
    )
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role) 
    AND id IN (
      SELECT fazenda_id 
      FROM public.user_fazendas 
      WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'consultor'::app_role) 
    AND (
      numerocm_consultor = get_user_consultor()
      OR EXISTS (
        SELECT 1 
        FROM public.consultores 
        WHERE consultores.numerocm_consultor = fazendas.numerocm_consultor 
        AND consultores.email = (auth.jwt()->>'email')
      )
    )
  )
  OR (
    has_role(auth.uid(), 'gestor'::app_role) 
    AND id IN (
      SELECT fazenda_id 
      FROM public.user_fazendas 
      WHERE user_id = auth.uid()
    )
  )
);