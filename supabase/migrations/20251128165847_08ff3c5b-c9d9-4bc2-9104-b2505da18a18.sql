-- Adicionar campo para associar gestor a consultor na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS numerocm_consultor_gestor text;

-- Atualizar RLS policy de produtores para incluir acesso de gestores via consultor
DROP POLICY IF EXISTS "Users can view produtores by role" ON public.produtores;

CREATE POLICY "Users can view produtores by role"
ON public.produtores
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  (has_role(auth.uid(), 'consultor') AND (
    numerocm_consultor = get_user_consultor() OR
    EXISTS (
      SELECT 1 FROM public.consultores c
      WHERE c.numerocm_consultor = public.produtores.numerocm_consultor
        AND c.email = auth.jwt() ->> 'email'
    )
  )) OR
  (has_role(auth.uid(), 'gestor') AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.numerocm_consultor_gestor = public.produtores.numerocm_consultor
  ))
);

-- Atualizar RLS policy de fazendas para incluir acesso de gestores via consultor
DROP POLICY IF EXISTS "Users can view fazendas by role" ON public.fazendas;

CREATE POLICY "Users can view fazendas by role"
ON public.fazendas
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  (has_role(auth.uid(), 'consultor') AND (
    numerocm_consultor = get_user_consultor() OR
    EXISTS (
      SELECT 1 FROM public.consultores c
      WHERE c.numerocm_consultor = public.fazendas.numerocm_consultor
        AND c.email = auth.jwt() ->> 'email'
    )
  )) OR
  (has_role(auth.uid(), 'gestor') AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.numerocm_consultor_gestor = public.fazendas.numerocm_consultor
  ))
);

-- Atualizar policy de UPDATE de fazendas
DROP POLICY IF EXISTS "Consultores and gestores can update fazendas" ON public.fazendas;

CREATE POLICY "Consultores and gestores can update fazendas"
ON public.fazendas
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR
  (has_role(auth.uid(), 'consultor') AND (
    numerocm_consultor = get_user_consultor() OR
    EXISTS (
      SELECT 1 FROM public.consultores c
      WHERE c.numerocm_consultor = public.fazendas.numerocm_consultor
        AND c.email = auth.jwt() ->> 'email'
    )
  )) OR
  (has_role(auth.uid(), 'gestor') AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.numerocm_consultor_gestor = public.fazendas.numerocm_consultor
  ))
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  (has_role(auth.uid(), 'consultor') AND (
    numerocm_consultor = get_user_consultor() OR
    EXISTS (
      SELECT 1 FROM public.consultores c
      WHERE c.numerocm_consultor = public.fazendas.numerocm_consultor
        AND c.email = auth.jwt() ->> 'email'
    )
  )) OR
  (has_role(auth.uid(), 'gestor') AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.numerocm_consultor_gestor = public.fazendas.numerocm_consultor
  ))
);