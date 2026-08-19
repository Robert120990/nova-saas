-- v141: Telegram - alertas y asistente (long polling) + detección de ventas sospechosas

-- Vinculación de chats de Telegram con empresa/sucursal
CREATE TABLE IF NOT EXISTS telegram_chat_bindings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  company_id INT NOT NULL,
  branch_id INT NOT NULL,
  nombre VARCHAR(255) NOT NULL DEFAULT '',
  username VARCHAR(255) NULL,
  receive_alerts TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_telegram_chat (chat_id),
  KEY idx_telegram_company_branch (company_id, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Canal Telegram en reglas de notificación
ALTER TABLE notification_rules
  ADD COLUMN channel_telegram TINYINT(1) NOT NULL DEFAULT 0 AFTER channel_whatsapp;

-- Configuración de detección de ventas sospechosas por sucursal
CREATE TABLE IF NOT EXISTS sale_suspicious_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  branch_id INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  monto_maximo DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  descuento_maximo_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  montos_redondos TINYINT(1) NOT NULL DEFAULT 1,
  horas_inicio TIME NOT NULL DEFAULT '00:00:00',
  horas_fin TIME NOT NULL DEFAULT '05:00:00',
  anulaciones_maximas INT NOT NULL DEFAULT 5,
  ventana_anulaciones_min INT NOT NULL DEFAULT 10,
  last_scan_sale_id BIGINT NULL,
  last_scan_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_suspicious (company_id, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sembrar configuración por defecto para todas las sucursales existentes
INSERT IGNORE INTO sale_suspicious_settings (company_id, branch_id)
SELECT company_id, id FROM branches;

-- Acción de notificación para ventas sospechosas
INSERT INTO notification_actions (code, name, description, category, icon, color, available_variables, default_title_template, default_body_template)
VALUES ('sale_suspicious', 'Venta sospechosa', 'Detecta ventas con criterios de venta sospechosa (monto alto, descuento excesivo, montos redondos, fuera de horario, anulaciones frecuentes)', 'ventas', 'AlertTriangle', '#dc2626',
 '["documento","cliente","monto","descuento","porcentaje_descuento","hora","usuario","sucursal","motivo","anulaciones"]',
 'Venta sospechosa detectada - {{documento}}',
 'Documento: {{documento}}\nCliente: {{cliente}}\nMonto: ${{monto}}\nHora: {{hora}}\nMotivo: {{motivo}}\nSucursal: {{sucursal}}')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), category = VALUES(category), icon = VALUES(icon), color = VALUES(color), available_variables = VALUES(available_variables), default_title_template = VALUES(default_title_template), default_body_template = VALUES(default_body_template);