-- Migration v85: Add filtro_departamento_id to rh_planilla_aguinaldos

ALTER TABLE rh_planilla_aguinaldos ADD COLUMN filtro_departamento_id INT NULL AFTER departamento_personal_id;
