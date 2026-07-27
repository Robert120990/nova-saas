INSERT INTO notification_actions (code, name, description, category, icon, color, available_variables, default_title_template, default_body_template)
VALUES ('gas_closeout_reopened', 'Cierre de turno reabierto', 'Cuando se reabre un cierre de turno en gasolinera', 'gasolinera', 'LockOpen', '#d97706',
 '["turno","fecha","sucursal"]',
 'Cierre de turno {{turno}} reabierto',
 'Turno: {{turno}}\nFecha: {{fecha}}\nSucursal: {{sucursal}}')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), category = VALUES(category), icon = VALUES(icon), color = VALUES(color), available_variables = VALUES(available_variables), default_title_template = VALUES(default_title_template), default_body_template = VALUES(default_body_template);
