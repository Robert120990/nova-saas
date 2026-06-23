ALTER TABLE customers
  ADD COLUMN es_credito BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN es_anticipado BOOLEAN NOT NULL DEFAULT FALSE;

-- Marcar como crédito clientes con ventas al crédito, pagos, o uso en gasolinera
UPDATE customers c
SET c.es_credito = TRUE
WHERE c.id IN (
  SELECT DISTINCT sh.customer_id
  FROM sales_headers sh
  WHERE (sh.payment_condition = 2 OR sh.condicion_operacion = 2)
    AND sh.estado != 'ANULADO'
    AND sh.customer_id IS NOT NULL
)
OR c.id IN (
  SELECT DISTINCT cp.customer_id FROM customer_payments cp
)
OR c.id IN (
  SELECT DISTINCT gcc.cliente_id FROM gas_station_closeout_creditos gcc WHERE gcc.cliente_id IS NOT NULL
)
OR c.id IN (
  SELECT DISTINCT gcv.cliente_id FROM gas_station_closeout_vales gcv WHERE gcv.cliente_id IS NOT NULL
);

-- Marcar como anticipado clientes usados en gasolinera (anticipos, créditos, vales, anticipos despachados)
UPDATE customers c
SET c.es_anticipado = TRUE
WHERE c.id IN (
  SELECT DISTINCT ga.cliente_id FROM gas_station_advances ga WHERE ga.cliente_id IS NOT NULL
)
OR c.id IN (
  SELECT DISTINCT gcc.cliente_id FROM gas_station_closeout_creditos gcc WHERE gcc.cliente_id IS NOT NULL
)
OR c.id IN (
  SELECT DISTINCT gcv.cliente_id FROM gas_station_closeout_vales gcv WHERE gcv.cliente_id IS NOT NULL
)
OR c.id IN (
  SELECT DISTINCT gcad.cliente_id FROM gas_station_closeout_anticipos_despachados gcad WHERE gcad.cliente_id IS NOT NULL
);
