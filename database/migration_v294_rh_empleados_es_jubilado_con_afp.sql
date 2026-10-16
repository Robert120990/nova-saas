-- Migration v294: Agregar columna es_jubilado_con_afp a rh_empleados
-- Permite distinguir a empleados pensionados que continúan cotizando AFP pero no ISSS y con renta 10%

ALTER TABLE rh_empleados
ADD COLUMN IF NOT EXISTS es_jubilado_con_afp TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 si es jubilado pero cotiza AFP (no ISSS, si AFP, renta 10%), 0 si no'
    AFTER es_jubilado;
