-- Add grupo and saldo columns to fertilizantes_catalog
ALTER TABLE public.fertilizantes_catalog
ADD COLUMN IF NOT EXISTS grupo text,
ADD COLUMN IF NOT EXISTS saldo numeric DEFAULT 0;

-- Create index on cod_item for better performance
CREATE INDEX IF NOT EXISTS idx_fertilizantes_catalog_cod_item 
ON public.fertilizantes_catalog(cod_item);