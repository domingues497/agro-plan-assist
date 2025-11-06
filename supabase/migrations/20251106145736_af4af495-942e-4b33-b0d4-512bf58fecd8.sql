-- Criar tabela de tratamentos de sementes (gerenciável pelo admin)
CREATE TABLE IF NOT EXISTS public.tratamentos_sementes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cultura TEXT NOT NULL CHECK (cultura IN ('MILHO', 'SOJA')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de justificativas para não fazer adubação (gerenciável pelo admin)
CREATE TABLE IF NOT EXISTS public.justificativas_adubacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar campos à tabela programacao_cultivares
ALTER TABLE public.programacao_cultivares
ADD COLUMN IF NOT EXISTS tipo_embalagem TEXT CHECK (tipo_embalagem IN ('BAG 5000K', 'SACAS 200K')),
ADD COLUMN IF NOT EXISTS tipo_tratamento TEXT CHECK (tipo_tratamento IN ('NÃO', 'NA FAZENDA', 'INDUSTRIAL')),
ADD COLUMN IF NOT EXISTS tratamento_id UUID REFERENCES public.tratamentos_sementes(id);

-- Adicionar campo à tabela programacao_adubacao para justificativa quando não houver adubação
ALTER TABLE public.programacao_adubacao
ADD COLUMN IF NOT EXISTS justificativa_nao_adubacao_id UUID REFERENCES public.justificativas_adubacao(id);

-- Adicionar campo cultura à tabela cultivares_catalog para filtrar tratamentos
ALTER TABLE public.cultivares_catalog
ADD COLUMN IF NOT EXISTS cultura TEXT CHECK (cultura IN ('MILHO', 'SOJA'));

-- Enable RLS nas novas tabelas
ALTER TABLE public.tratamentos_sementes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justificativas_adubacao ENABLE ROW LEVEL SECURITY;

-- Políticas para tratamentos_sementes
CREATE POLICY "Admins can manage tratamentos_sementes"
  ON public.tratamentos_sementes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active tratamentos_sementes"
  ON public.tratamentos_sementes
  FOR SELECT
  USING (ativo = true);

-- Políticas para justificativas_adubacao
CREATE POLICY "Admins can manage justificativas_adubacao"
  ON public.justificativas_adubacao
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active justificativas_adubacao"
  ON public.justificativas_adubacao
  FOR SELECT
  USING (ativo = true);

-- Inserir dados iniciais de tratamentos
INSERT INTO public.tratamentos_sementes (nome, cultura) VALUES
  ('Tratamento Padrão Milho 1', 'MILHO'),
  ('Tratamento Padrão Milho 2', 'MILHO'),
  ('Tratamento Padrão Soja 1', 'SOJA'),
  ('Tratamento Padrão Soja 2', 'SOJA');

-- Inserir dados iniciais de justificativas
INSERT INTO public.justificativas_adubacao (descricao) VALUES
  ('Adubação já realizada anteriormente'),
  ('Solo com nutrientes suficientes'),
  ('Decisão do produtor'),
  ('Falta de recursos financeiros'),
  ('Outras razões técnicas');