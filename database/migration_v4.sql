ALTER TABLE products ADD COLUMN tipo_operacion INT DEFAULT 1 COMMENT "1: Gravada, 2: Exenta, 3: No Sujeta";
ALTER TABLE products ADD COLUMN tipo_combustible INT DEFAULT 0 COMMENT "0: Ninguno, 1: Regular, 2: Especial, 3: Diesel";
ALTER TABLE products MODIFY COLUMN tipo_item VARCHAR(10);
ALTER TABLE products MODIFY COLUMN unidad_medida VARCHAR(10);
ALTER TABLE products DROP COLUMN es_gravado;
ALTER TABLE products DROP COLUMN exento_iva;
ALTER TABLE products DROP COLUMN aplica_iva;
ALTER TABLE products DROP COLUMN aplica_fovial;
ALTER TABLE products DROP COLUMN aplica_cotrans;
CREATE TABLE IF NOT EXISTS product_tributes (
    product_id INT NOT NULL,
    tribute_code VARCHAR(10) NOT NULL,
    PRIMARY KEY (product_id, tribute_code),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
