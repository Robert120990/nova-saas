-- Migration v86: Recursos Humanos - Cuentas de Planillas
-- Configuración de partidas/líneas que componen el cálculo de planilla

CREATE TABLE IF NOT EXISTS rh_cuentas_planillas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  tipo ENUM('percepcion', 'deduccion') NOT NULL DEFAULT 'percepcion',
  operacion ENUM('sumar', 'restar') NOT NULL DEFAULT 'sumar',
  tipo_valor ENUM('valor', 'dias', 'horas', 'porcentaje') NOT NULL DEFAULT 'valor',
  valor_base DECIMAL(12,4) NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  aparece_recibos TINYINT(1) NOT NULL DEFAULT 1,
  aparece_planilla TINYINT(1) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cuenta_planilla_company_codigo (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
