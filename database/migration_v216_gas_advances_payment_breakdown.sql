-- Migration v216: Desglose de métodos de pago en anticipos de gasolinera
-- Agrega columnas para efectivo, tarjeta, cheque, transferencia y sus números de referencia.
-- Asigna el monto existente a efectivo.

ALTER TABLE gas_station_advances
    ADD COLUMN efectivo DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER notas,
    ADD COLUMN tarjeta DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER efectivo,
    ADD COLUMN tarjeta_referencia VARCHAR(100) NULL AFTER tarjeta,
    ADD COLUMN cheque DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER tarjeta_referencia,
    ADD COLUMN cheque_referencia VARCHAR(100) NULL AFTER cheque,
    ADD COLUMN transferencia DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER cheque_referencia,
    ADD COLUMN transferencia_referencia VARCHAR(100) NULL AFTER transferencia;

-- Backfill para registros existentes: el monto se asigna a efectivo
UPDATE gas_station_advances
SET efectivo = monto
WHERE efectivo = 0 OR efectivo IS NULL;
