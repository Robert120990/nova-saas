CREATE TABLE IF NOT EXISTS rh_empleado_emergency_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  parentesco VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrar contactos existentes a la nueva tabla
INSERT INTO rh_empleado_emergency_contacts (empleado_id, nombre, telefono)
SELECT id, contacto_emergencia_nombre, contacto_emergencia_telefono
FROM rh_empleados
WHERE contacto_emergencia_nombre IS NOT NULL OR contacto_emergencia_telefono IS NOT NULL;

-- Eliminar columnas viejas
ALTER TABLE rh_empleados DROP COLUMN contacto_emergencia_nombre;
ALTER TABLE rh_empleados DROP COLUMN contacto_emergencia_telefono;
