-- Tabela para programação de cultivares (sementes)
CREATE TABLE public.programacao_cultivares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cultivar TEXT NOT NULL,
  area TEXT NOT NULL,
  quantidade DECIMAL(10,2) NOT NULL,
  unidade TEXT DEFAULT 'kg',
  data_plantio DATE,
  safra TEXT,
  semente_propria BOOLEAN DEFAULT false,
  referencia_rnc_mapa TEXT,
  porcentagem_salva DECIMAL(5,2) DEFAULT 0 CHECK (porcentagem_salva >= 0 AND porcentagem_salva <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para programação de adubação
CREATE TABLE public.programacao_adubacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formulacao TEXT NOT NULL,
  area TEXT NOT NULL,
  dose DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2),
  data_aplicacao DATE,
  responsavel TEXT,
  fertilizante_salvo BOOLEAN DEFAULT false,
  deve_faturar BOOLEAN DEFAULT true,
  porcentagem_salva DECIMAL(5,2) DEFAULT 0 CHECK (porcentagem_salva >= 0 AND porcentagem_salva <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para programação de defensivos
CREATE TABLE public.programacao_defensivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  defensivo TEXT NOT NULL,
  area TEXT NOT NULL,
  dose DECIMAL(10,2) NOT NULL,
  unidade TEXT DEFAULT 'L/ha',
  data_aplicacao DATE,
  alvo TEXT,
  produto_salvo BOOLEAN DEFAULT false,
  deve_faturar BOOLEAN DEFAULT true,
  porcentagem_salva DECIMAL(5,2) DEFAULT 0 CHECK (porcentagem_salva >= 0 AND porcentagem_salva <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.programacao_cultivares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacao_adubacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programacao_defensivos ENABLE ROW LEVEL SECURITY;

-- RLS Policies para programacao_cultivares
CREATE POLICY "Users can view own cultivares"
  ON public.programacao_cultivares FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cultivares"
  ON public.programacao_cultivares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cultivares"
  ON public.programacao_cultivares FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cultivares"
  ON public.programacao_cultivares FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para programacao_adubacao
CREATE POLICY "Users can view own adubacao"
  ON public.programacao_adubacao FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adubacao"
  ON public.programacao_adubacao FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adubacao"
  ON public.programacao_adubacao FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own adubacao"
  ON public.programacao_adubacao FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para programacao_defensivos
CREATE POLICY "Users can view own defensivos"
  ON public.programacao_defensivos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own defensivos"
  ON public.programacao_defensivos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own defensivos"
  ON public.programacao_defensivos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own defensivos"
  ON public.programacao_defensivos FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_programacao_cultivares_updated_at
  BEFORE UPDATE ON public.programacao_cultivares
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_programacao_adubacao_updated_at
  BEFORE UPDATE ON public.programacao_adubacao
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_programacao_defensivos_updated_at
  BEFORE UPDATE ON public.programacao_defensivos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();