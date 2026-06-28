-- Migration v76: Fix rh_empleados column sizes for departamento/municipio (must store MH codes, not names)

ALTER TABLE rh_empleados MODIFY COLUMN departamento VARCHAR(10) NULL;
ALTER TABLE rh_empleados MODIFY COLUMN municipio VARCHAR(10) NULL;
