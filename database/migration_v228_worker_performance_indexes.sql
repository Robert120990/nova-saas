-- Migración v228: Índices de rendimiento para colas de transmisión DTE y ventas por sucursal

-- 1. Tabla: transmission_queue (optimiza consulta periódica del worker cada 60s)
ALTER TABLE transmission_queue ADD INDEX idx_tq_status_next_attempts (status, next_attempt_at, attempts);

-- 2. Tabla: dte_contingency_documents (optimiza consulta periódica del worker de contingencia)
ALTER TABLE dte_contingency_documents ADD INDEX idx_contingency_estado_retry (estado_envio, retry_count, created_at);

-- 3. Tabla: sales_headers (optimiza consultas de ventas y reportes filtrados por sucursal y fecha)
ALTER TABLE sales_headers ADD INDEX idx_sales_branch_fecha (branch_id, fecha_emision);
