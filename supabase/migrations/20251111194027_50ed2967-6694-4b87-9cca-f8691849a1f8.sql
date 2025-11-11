-- Criar tabela para rastrear histórico de importações
CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tabela_nome TEXT NOT NULL,
  registros_importados INTEGER NOT NULL DEFAULT 0,
  registros_deletados INTEGER NOT NULL DEFAULT 0,
  arquivo_nome TEXT,
  limpar_antes BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar import_history
CREATE POLICY "Admins can manage import_history"
ON public.import_history
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários podem ver seu próprio histórico
CREATE POLICY "Users can view own import_history"
ON public.import_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Criar índice para melhorar performance
CREATE INDEX idx_import_history_user_id ON public.import_history(user_id);
CREATE INDEX idx_import_history_created_at ON public.import_history(created_at DESC);