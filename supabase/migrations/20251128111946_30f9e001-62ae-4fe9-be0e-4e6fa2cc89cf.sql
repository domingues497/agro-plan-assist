-- Add arrendado column to talhoes table
ALTER TABLE public.talhoes 
ADD COLUMN arrendado boolean NOT NULL DEFAULT false;