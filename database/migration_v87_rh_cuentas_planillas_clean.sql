-- Migration v87: Limpiar campos redundantes de cuentas de planillas

ALTER TABLE rh_cuentas_planillas DROP COLUMN tipo;
ALTER TABLE rh_cuentas_planillas DROP COLUMN valor_base;
