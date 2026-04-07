-- Migración V14: Eliminar cantidad y precio_unitario de expense_items
ALTER TABLE expense_items DROP COLUMN cantidad;
ALTER TABLE expense_items DROP COLUMN precio_unitario;
