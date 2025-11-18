-- Corrige FK incorreta de safra_id em programacao_defensivos
-- O FK atual referencia a própria tabela programacao_defensivos (errado).
-- Deve referenciar public.safras(id).

ALTER TABLE public.programacao_defensivos
  DROP CONSTRAINT IF EXISTS programacao_defensivos_safra_id_fkey;

ALTER TABLE public.programacao_defensivos
  ADD CONSTRAINT programacao_defensivos_safra_id_fkey
  FOREIGN KEY (safra_id)
  REFERENCES public.safras(id);

-- Opcional: índice para consultas por safra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_programacao_defensivos_safra_id'
  ) THEN
    CREATE INDEX idx_programacao_defensivos_safra_id ON public.programacao_defensivos (safra_id);
  END IF;
END $$;