-- Remove a constraint que limita cultura apenas a MILHO e SOJA
ALTER TABLE cultivares_catalog 
DROP CONSTRAINT IF EXISTS cultivares_catalog_cultura_check;