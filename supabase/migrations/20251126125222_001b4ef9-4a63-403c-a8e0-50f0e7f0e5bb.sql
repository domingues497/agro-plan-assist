-- Step 1: Update cultivares_tratamentos to use cultivar values instead of cod_item
-- Create a temporary column for the new cultivar reference
ALTER TABLE cultivares_tratamentos ADD COLUMN IF NOT EXISTS cultivar_temp TEXT;

-- Populate the temp column with cultivar values from cultivares_catalog
UPDATE cultivares_tratamentos ct
SET cultivar_temp = cc.cultivar
FROM cultivares_catalog cc
WHERE ct.cultivar_cod_item = cc.cod_item;

-- Step 2: Remove any orphaned records that don't have a matching cultivar
DELETE FROM cultivares_tratamentos WHERE cultivar_temp IS NULL;

-- Step 3: Drop the old foreign key if it exists
ALTER TABLE cultivares_tratamentos 
  DROP CONSTRAINT IF EXISTS cultivares_tratamentos_cultivar_cod_item_fkey CASCADE;

-- Step 4: Remove duplicates from cultivares_catalog, keeping first by created_at
DELETE FROM cultivares_catalog
WHERE id NOT IN (
  SELECT DISTINCT ON (cultivar) id
  FROM cultivares_catalog
  WHERE cultivar IS NOT NULL
  ORDER BY cultivar, created_at
);

-- Step 5: Remove constraints from cultivares_catalog
ALTER TABLE cultivares_catalog 
  DROP CONSTRAINT IF EXISTS cultivares_catalog_pkey CASCADE,
  DROP CONSTRAINT IF EXISTS cultivares_catalog_cod_item_key CASCADE;

-- Step 6: Add nome_cientifico column
ALTER TABLE cultivares_catalog 
  ADD COLUMN IF NOT EXISTS nome_cientifico TEXT;

-- Step 7: Make cultivar unique
ALTER TABLE cultivares_catalog 
  ADD CONSTRAINT cultivares_catalog_cultivar_key UNIQUE (cultivar);

-- Step 8: Remove old columns from cultivares_catalog
ALTER TABLE cultivares_catalog 
  DROP COLUMN IF EXISTS cod_item CASCADE,
  DROP COLUMN IF EXISTS item,
  DROP COLUMN IF EXISTS grupo,
  DROP COLUMN IF EXISTS marca;

-- Step 9: Drop old column and rename temp column in cultivares_tratamentos
ALTER TABLE cultivares_tratamentos DROP COLUMN IF EXISTS cultivar_cod_item;
ALTER TABLE cultivares_tratamentos RENAME COLUMN cultivar_temp TO cultivar;

-- Step 10: Make cultivar NOT NULL in cultivares_tratamentos
ALTER TABLE cultivares_tratamentos ALTER COLUMN cultivar SET NOT NULL;

-- Step 11: Add foreign key using cultivar
ALTER TABLE cultivares_tratamentos
  ADD CONSTRAINT cultivares_tratamentos_cultivar_fkey 
  FOREIGN KEY (cultivar) 
  REFERENCES cultivares_catalog(cultivar) 
  ON DELETE CASCADE;