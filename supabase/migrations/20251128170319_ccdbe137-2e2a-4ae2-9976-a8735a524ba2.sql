-- Criar tabela para relacionamento many-to-many entre gestores e consultores
CREATE TABLE IF NOT EXISTS public.gestor_consultores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numerocm_consultor text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, numerocm_consultor)
);

-- Enable RLS
ALTER TABLE public.gestor_consultores ENABLE ROW LEVEL SECURITY;

-- RLS policies para gestor_consultores
CREATE POLICY "Admins can manage all gestor_consultores"
ON public.gestor_consultores
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view own gestor_consultores"
ON public.gestor_consultores
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  (has_role(auth.uid(), 'gestor') AND user_id = auth.uid())
);

-- Migrar dados existentes de profiles para gestor_consultores
INSERT INTO public.gestor_consultores (user_id, numerocm_consultor)
SELECT user_id, numerocm_consultor_gestor 
FROM public.profiles 
WHERE numerocm_consultor_gestor IS NOT NULL
ON CONFLICT (user_id, numerocm_consultor) DO NOTHING;

-- Atualizar RLS policy de produtores
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
  (has_role(auth.uid(), 'gestor') AND numerocm_consultor IN (
    SELECT gc.numerocm_consultor 
    FROM public.gestor_consultores gc 
    WHERE gc.user_id = auth.uid()
  ))
);

-- Atualizar RLS policy de fazendas para SELECT
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
  (has_role(auth.uid(), 'gestor') AND numerocm_consultor IN (
    SELECT gc.numerocm_consultor 
    FROM public.gestor_consultores gc 
    WHERE gc.user_id = auth.uid()
  ))
);

-- Atualizar RLS policy de fazendas para UPDATE
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
  (has_role(auth.uid(), 'gestor') AND numerocm_consultor IN (
    SELECT gc.numerocm_consultor 
    FROM public.gestor_consultores gc 
    WHERE gc.user_id = auth.uid()
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
  (has_role(auth.uid(), 'gestor') AND numerocm_consultor IN (
    SELECT gc.numerocm_consultor 
    FROM public.gestor_consultores gc 
    WHERE gc.user_id = auth.uid()
  ))
);

-- Atualizar RLS policy de talhoes para permitir gestores
DROP POLICY IF EXISTS "Consultores can manage own talhoes" ON public.talhoes;

CREATE POLICY "Consultores and gestores can manage talhoes"
ON public.talhoes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.fazendas f
    WHERE f.id = public.talhoes.fazenda_id
      AND (
        has_role(auth.uid(), 'admin') OR
        (has_role(auth.uid(), 'consultor') AND f.numerocm_consultor = get_user_consultor()) OR
        (has_role(auth.uid(), 'gestor') AND f.numerocm_consultor IN (
          SELECT gc.numerocm_consultor 
          FROM public.gestor_consultores gc 
          WHERE gc.user_id = auth.uid()
        ))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.fazendas f
    WHERE f.id = public.talhoes.fazenda_id
      AND (
        has_role(auth.uid(), 'admin') OR
        (has_role(auth.uid(), 'consultor') AND f.numerocm_consultor = get_user_consultor()) OR
        (has_role(auth.uid(), 'gestor') AND f.numerocm_consultor IN (
          SELECT gc.numerocm_consultor 
          FROM public.gestor_consultores gc 
          WHERE gc.user_id = auth.uid()
        ))
      )
  )
);

-- Adicionar policy para gestores verem programações
CREATE POLICY "Gestores can view programacoes"
ON public.programacoes
FOR SELECT
USING (
  auth.uid() = user_id OR
  (has_role(auth.uid(), 'gestor') AND EXISTS (
    SELECT 1 FROM public.produtores p
    WHERE p.numerocm = public.programacoes.produtor_numerocm
      AND p.numerocm_consultor IN (
        SELECT gc.numerocm_consultor 
        FROM public.gestor_consultores gc 
        WHERE gc.user_id = auth.uid()
      )
  ))
);

-- Adicionar policy para gestores verem programacao_cultivares
CREATE POLICY "Gestores can view cultivares"
ON public.programacao_cultivares
FOR SELECT
USING (
  auth.uid() = user_id OR
  (has_role(auth.uid(), 'gestor') AND produtor_numerocm IN (
    SELECT p.numerocm FROM public.produtores p
    WHERE p.numerocm_consultor IN (
      SELECT gc.numerocm_consultor 
      FROM public.gestor_consultores gc 
      WHERE gc.user_id = auth.uid()
    )
  ))
);

-- Adicionar policy para gestores verem programacao_adubacao
CREATE POLICY "Gestores can view adubacao"
ON public.programacao_adubacao
FOR SELECT
USING (
  auth.uid() = user_id OR
  (has_role(auth.uid(), 'gestor') AND produtor_numerocm IN (
    SELECT p.numerocm FROM public.produtores p
    WHERE p.numerocm_consultor IN (
      SELECT gc.numerocm_consultor 
      FROM public.gestor_consultores gc 
      WHERE gc.user_id = auth.uid()
    )
  ))
);

-- Adicionar policy para gestores verem programacao_defensivos
CREATE POLICY "Gestores can view defensivos"
ON public.programacao_defensivos
FOR SELECT
USING (
  auth.uid() = user_id OR
  (has_role(auth.uid(), 'gestor') AND EXISTS (
    SELECT 1 FROM public.aplicacoes_defensivos ad
    WHERE ad.id = public.programacao_defensivos.aplicacao_id
      AND ad.produtor_numerocm IN (
        SELECT p.numerocm FROM public.produtores p
        WHERE p.numerocm_consultor IN (
          SELECT gc.numerocm_consultor 
          FROM public.gestor_consultores gc 
          WHERE gc.user_id = auth.uid()
        )
      )
  ))
);