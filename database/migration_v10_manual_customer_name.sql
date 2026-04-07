-- Migration: V10 Manual Customer Name
USE db_sistema_saas;

ALTER TABLE sales_headers ADD COLUMN cliente_nombre VARCHAR(255) DEFAULT NULL;
