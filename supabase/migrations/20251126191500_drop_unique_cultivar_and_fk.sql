-- Remove UNIQUE(cultivar) to permitir duplicatas por cultura
ALTER TABLE public.cultivares_catalog
  DROP CONSTRAINT IF EXISTS cultivares_catalog_cultivar_key;

-- Remover FK que referencia somente cultivar, pois não há mais unicidade
ALTER TABLE public.cultivares_tratamentos
  DROP CONSTRAINT IF EXISTS cultivares_tratamentos_cultivar_fkey;

-- Observação: após essa alteração, recomenda-se migrar cultivares_tratamentos
-- para referenciar par (cultivar, cultura) ou um identificador único (id).
