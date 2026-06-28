-- Migration v77: Add foreign keys for departamento, municipio, distrito referencing MH catalogs

ALTER TABLE rh_empleados
  ADD CONSTRAINT fk_empleado_departamento
    FOREIGN KEY (departamento) REFERENCES cat_012_departamento(code) ON DELETE SET NULL,
  ADD CONSTRAINT fk_empleado_municipio
    FOREIGN KEY (municipio, departamento) REFERENCES cat_013_municipio(code, dep_code) ON DELETE SET NULL,
  ADD CONSTRAINT fk_empleado_distrito
    FOREIGN KEY (departamento, distrito) REFERENCES cat_008_distrito(dep_code, code) ON DELETE SET NULL;
