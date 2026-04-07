-- Migration: Align DB with UI catalog forms (V2)

-- Branches migration
ALTER TABLE branches ADD COLUMN es_casa_matriz BOOLEAN DEFAULT FALSE;
ALTER TABLE branches CHANGE COLUMN codigo_sucursal_mh codigo_mh VARCHAR(10);

-- Providers migration
ALTER TABLE providers ADD COLUMN tipo_documento VARCHAR(20);
ALTER TABLE providers ADD COLUMN numero_documento VARCHAR(20);
ALTER TABLE providers ADD COLUMN id_actividad INT;

-- Products migration
ALTER TABLE products ADD COLUMN nombre VARCHAR(100) AFTER company_id;
ALTER TABLE products CHANGE COLUMN precio precio_unitario DECIMAL(18, 6);
ALTER TABLE products CHANGE COLUMN tipo_producto tipo_item VARCHAR(20);
ALTER TABLE products CHANGE COLUMN afecto_iva es_gravado BOOLEAN DEFAULT TRUE;
-- id_actividad removed from requirements
