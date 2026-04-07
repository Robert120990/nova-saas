-- Migration v9: Agregar permiso de edición de precio a vendedores
USE db_sistema_saas;
ALTER TABLE sellers ADD COLUMN allow_price_edit BOOLEAN DEFAULT FALSE;
