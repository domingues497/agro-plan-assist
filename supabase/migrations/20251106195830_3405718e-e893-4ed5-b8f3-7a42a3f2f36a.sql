-- Criar tabela de junção para relacionamento N:N entre programacao_cultivares e tratamentos_sementes
CREATE TABLE public.programacao_cultivares_tratamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  programacao_cultivar_id uuid NOT NULL REFERENCES public.programacao_cultivares(id) ON DELETE CASCADE,
  tratamento_id uuid NOT NULL REFERENCES public.tratamentos_sementes(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(programacao_cultivar_id, tratamento_id)
);

-- Habilitar RLS
ALTER TABLE public.programacao_cultivares_tratamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own cultivares tratamentos"
ON public.programacao_cultivares_tratamentos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.programacao_cultivares pc
    WHERE pc.id = programacao_cultivares_tratamentos.programacao_cultivar_id
    AND pc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own cultivares tratamentos"
ON public.programacao_cultivares_tratamentos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.programacao_cultivares pc
    WHERE pc.id = programacao_cultivares_tratamentos.programacao_cultivar_id
    AND pc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own cultivares tratamentos"
ON public.programacao_cultivares_tratamentos
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.programacao_cultivares pc
    WHERE pc.id = programacao_cultivares_tratamentos.programacao_cultivar_id
    AND pc.user_id = auth.uid()
  )
);

-- Índices para melhor performance
CREATE INDEX idx_prog_cult_trat_cultivar ON public.programacao_cultivares_tratamentos(programacao_cultivar_id);
CREATE INDEX idx_prog_cult_trat_tratamento ON public.programacao_cultivares_tratamentos(tratamento_id);

-- Trigger para updated_at
CREATE TRIGGER update_programacao_cultivares_tratamentos_updated_at
BEFORE UPDATE ON public.programacao_cultivares_tratamentos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();