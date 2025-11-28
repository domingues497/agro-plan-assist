-- Criar tabela user_produtores
CREATE TABLE IF NOT EXISTS public.user_produtores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produtor_numerocm TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, produtor_numerocm)
);

-- Criar tabela user_fazendas
CREATE TABLE IF NOT EXISTS public.user_fazendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fazenda_id UUID NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, fazenda_id)
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.user_produtores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_fazendas ENABLE ROW LEVEL SECURITY;

-- Políticas para user_produtores
CREATE POLICY "Admins can manage all user_produtores"
  ON public.user_produtores
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view own user_produtores"
  ON public.user_produtores
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'gestor') AND user_id = auth.uid()
  );

-- Políticas para user_fazendas
CREATE POLICY "Admins can manage all user_fazendas"
  ON public.user_fazendas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view own user_fazendas"
  ON public.user_fazendas
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'gestor') AND user_id = auth.uid()
  );

-- Atualizar políticas de produtores para incluir gestores
DROP POLICY IF EXISTS "Consultores can view own produtores" ON public.produtores;

CREATE POLICY "Users can view produtores by role"
  ON public.produtores
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR
    (has_role(auth.uid(), 'consultor') AND numerocm_consultor = get_user_consultor()) OR
    (has_role(auth.uid(), 'gestor') AND numerocm IN (
      SELECT produtor_numerocm FROM public.user_produtores WHERE user_id = auth.uid()
    ))
  );

-- Atualizar políticas de fazendas para incluir gestores
DROP POLICY IF EXISTS "Consultores can view own fazendas" ON public.fazendas;
DROP POLICY IF EXISTS "Consultores can update own fazendas" ON public.fazendas;

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
    (has_role(auth.uid(), 'gestor') AND id IN (
      SELECT fazenda_id FROM public.user_fazendas WHERE user_id = auth.uid()
    ))
  );

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
    (has_role(auth.uid(), 'gestor') AND id IN (
      SELECT fazenda_id FROM public.user_fazendas WHERE user_id = auth.uid()
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
    (has_role(auth.uid(), 'gestor') AND id IN (
      SELECT fazenda_id FROM public.user_fazendas WHERE user_id = auth.uid()
    ))
  );
