-- Tabelas de Consultores e Produtores e ajustes de RLS

-- Tabela de consultores (representantes)
CREATE TABLE IF NOT EXISTS public.consultores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numerocm_consultor TEXT UNIQUE NOT NULL,
  consultor TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consultores ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer autenticado pode visualizar, somente admin pode escrever
CREATE POLICY IF NOT EXISTS "Anyone can view consultores"
  ON public.consultores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage consultores"
  ON public.consultores FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de produtores
CREATE TABLE IF NOT EXISTS public.produtores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numerocm TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  numerocm_consultor TEXT NOT NULL REFERENCES public.consultores(numerocm_consultor) ON UPDATE CASCADE ON DELETE RESTRICT,
  consultor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.produtores ENABLE ROW LEVEL SECURITY;

-- Políticas: consultor autenticado só visualiza seus produtores; admin gerencia todos
CREATE POLICY IF NOT EXISTS "Consultants can view own produtores"
  ON public.produtores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.consultores c
      WHERE c.numerocm_consultor = public.produtores.numerocm_consultor
        AND c.email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can manage produtores"
  ON public.produtores FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers updated_at
CREATE TRIGGER update_consultores_updated_at
  BEFORE UPDATE ON public.consultores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_produtores_updated_at
  BEFORE UPDATE ON public.produtores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Adicionar coluna produtor_numerocm nas tabelas de programação
ALTER TABLE public.programacao_cultivares
  ADD COLUMN IF NOT EXISTS produtor_numerocm TEXT NOT NULL;

ALTER TABLE public.programacao_adubacao
  ADD COLUMN IF NOT EXISTS produtor_numerocm TEXT NOT NULL;

ALTER TABLE public.programacao_defensivos
  ADD COLUMN IF NOT EXISTS produtor_numerocm TEXT NOT NULL;

-- FKs para produtores
ALTER TABLE public.programacao_cultivares
  ADD CONSTRAINT IF NOT EXISTS fk_programacao_cultivares_produtor
  FOREIGN KEY (produtor_numerocm) REFERENCES public.produtores(numerocm) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.programacao_adubacao
  ADD CONSTRAINT IF NOT EXISTS fk_programacao_adubacao_produtor
  FOREIGN KEY (produtor_numerocm) REFERENCES public.produtores(numerocm) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.programacao_defensivos
  ADD CONSTRAINT IF NOT EXISTS fk_programacao_defensivos_produtor
  FOREIGN KEY (produtor_numerocm) REFERENCES public.produtores(numerocm) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Atualizar políticas de INSERT/UPDATE para checar vínculo do produtor
-- Cultivares
DROP POLICY IF EXISTS "Users can insert own cultivares" ON public.programacao_cultivares;
CREATE POLICY "Users can insert own cultivares"
  ON public.programacao_cultivares FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.consultores c
      JOIN public.produtores p ON p.numerocm_consultor = c.numerocm_consultor
      WHERE p.numerocm = programacao_cultivares.produtor_numerocm
        AND c.email = auth.jwt() ->> 'email'
    )
  );

DROP POLICY IF EXISTS "Users can update own cultivares" ON public.programacao_cultivares;
CREATE POLICY "Users can update own cultivares"
  ON public.programacao_cultivares FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.consultores c
      JOIN public.produtores p ON p.numerocm_consultor = c.numerocm_consultor
      WHERE p.numerocm = programacao_cultivares.produtor_numerocm
        AND c.email = auth.jwt() ->> 'email'
    )
  );

-- Adubacao
DROP POLICY IF EXISTS "Users can insert own adubacao" ON public.programacao_adubacao;
CREATE POLICY "Users can insert own adubacao"
  ON public.programacao_adubacao FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.consultores c
      JOIN public.produtores p ON p.numerocm_consultor = c.numerocm_consultor
      WHERE p.numerocm = programacao_adubacao.produtor_numerocm
        AND c.email = auth.jwt() ->> 'email'
    )
  );

DROP POLICY IF EXISTS "Users can update own adubacao" ON public.programacao_adubacao;
CREATE POLICY "Users can update own adubacao"
  ON public.programacao_adubacao FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.consultores c
      JOIN public.produtores p ON p.numerocm_consultor = c.numerocm_consultor
      WHERE p.numerocm = programacao_adubacao.produtor_numerocm
        AND c.email = auth.jwt() ->> 'email'
    )
  );

-- Defensivos
DROP POLICY IF EXISTS "Users can insert own defensivos" ON public.programacao_defensivos;
CREATE POLICY "Users can insert own defensivos"
  ON public.programacao_defensivos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.consultores c
      JOIN public.produtores p ON p.numerocm_consultor = c.numerocm_consultor
      WHERE p.numerocm = programacao_defensivos.produtor_numerocm
        AND c.email = auth.jwt() ->> 'email'
    )
  );

DROP POLICY IF EXISTS "Users can update own defensivos" ON public.programacao_defensivos;
CREATE POLICY "Users can update own defensivos"
  ON public.programacao_defensivos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.consultores c
      JOIN public.produtores p ON p.numerocm_consultor = c.numerocm_consultor
      WHERE p.numerocm = programacao_defensivos.produtor_numerocm
        AND c.email = auth.jwt() ->> 'email'
    )
  );