ALTER TABLE purchase_headers
  ADD COLUMN dias_credito INT DEFAULT 0 AFTER condicion_operacion_id,
  ADD COLUMN fecha_vencimiento DATE AFTER dias_credito;
