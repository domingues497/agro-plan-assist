-- Passo 1: Remover FK primeiro (depende do UNIQUE constraint)
ALTER TABLE public.cultivares_tratamentos
  DROP CONSTRAINT IF EXISTS cultivares_tratamentos_cultivar_fkey;

-- Passo 2: Remover constraint UNIQUE(cultivar)
ALTER TABLE public.cultivares_catalog
  DROP CONSTRAINT IF EXISTS cultivares_catalog_cultivar_key;

-- Passo 3: Remover duplicatas exatas do par (cultivar, cultura) antes de criar índice único
DELETE FROM public.cultivares_catalog a
USING public.cultivares_catalog b
WHERE a.ctid < b.ctid
  AND a.cultivar = b.cultivar
  AND (a.cultura IS NOT DISTINCT FROM b.cultura);

-- Passo 4: Criar índice único composto para suportar ON CONFLICT (cultivar, cultura)
CREATE UNIQUE INDEX IF NOT EXISTS cultivars_catalog_unique_cultivar_cultura
ON public.cultivares_catalog (cultivar, cultura);