ALTER TABLE tax_configurations 
ADD COLUMN compras_afectan_libro_compras BOOLEAN NOT NULL DEFAULT FALSE 
AFTER percepcion_rate;
