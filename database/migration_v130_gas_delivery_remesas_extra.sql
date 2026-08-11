-- Migration v130: Otras remesas en entregas de remesas de gasolinera
-- Remesas adicionales ingresadas manualmente (descripcion + monto) que se
-- envían individualmente a RRS al marcar la entrega como entregada.

CREATE TABLE IF NOT EXISTS gas_station_delivery_remesas_extra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL,
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_extra_delivery (delivery_id),
    CONSTRAINT fk_extra_delivery FOREIGN KEY (delivery_id)
        REFERENCES gas_station_remesa_deliveries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;