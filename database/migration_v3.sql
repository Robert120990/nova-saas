-- Migration: Add missing contact and location columns (V3 Simplified)
USE db_sistema_saas;

-- Branches
ALTER TABLE branches ADD COLUMN telefono VARCHAR(20);
ALTER TABLE branches ADD COLUMN correo VARCHAR(100);

-- Providers
ALTER TABLE providers ADD COLUMN departamento VARCHAR(50);
ALTER TABLE providers ADD COLUMN municipio VARCHAR(50);
ALTER TABLE providers ADD COLUMN nit VARCHAR(17);
ALTER TABLE providers ADD COLUMN nrc VARCHAR(10);
ALTER TABLE providers ADD COLUMN tipo_documento VARCHAR(20);
ALTER TABLE providers ADD COLUMN numero_documento VARCHAR(20);
ALTER TABLE providers ADD COLUMN id_actividad INT;
