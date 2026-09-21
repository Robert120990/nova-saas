-- Migration v207: Add gas_credito_id to customer_payments
-- Permite vincular abonos de clientes a ventas al crédito de gasolinera (gas_station_closeout_creditos)

ALTER TABLE customer_payments
  ADD COLUMN gas_credito_id INT DEFAULT NULL AFTER sale_id,
  ADD CONSTRAINT fk_cp_gas_credito FOREIGN KEY (gas_credito_id) REFERENCES gas_station_closeout_creditos(id) ON DELETE SET NULL,
  ADD INDEX idx_cp_gas_credito (gas_credito_id);
