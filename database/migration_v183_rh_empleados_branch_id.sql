-- Migration v183: Add branch_id to rh_empleados
ALTER TABLE rh_empleados ADD COLUMN branch_id INT NULL AFTER departamento_personal_id;

ALTER TABLE rh_empleados ADD CONSTRAINT fk_rh_empleados_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
