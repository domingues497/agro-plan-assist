-- Recriar a tabela cultivares_catalog com a nova estrutura
DROP TABLE IF EXISTS cultivares_catalog CASCADE;

CREATE TABLE cultivares_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cod_item TEXT NOT NULL UNIQUE,
  item TEXT,
  grupo TEXT,
  marca TEXT,
  cultivar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE cultivares_catalog ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage cultivares catalog" 
ON cultivares_catalog 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view cultivares catalog" 
ON cultivares_catalog 
FOR SELECT 
USING (true);