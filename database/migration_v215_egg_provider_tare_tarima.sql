-- Migración v215: Añadir tara de tarima física/pallet a configuración de proveedores de huevo
ALTER TABLE egg_provider_lot_configurations 
ADD COLUMN tare_tarima_lbs DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Tara de tarima física/pallet (lbs)' AFTER format_pattern;
