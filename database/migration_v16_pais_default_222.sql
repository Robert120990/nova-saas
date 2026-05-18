UPDATE customers SET pais = '222' WHERE pais IS NULL OR pais = '' OR pais = 'El Salvador' OR pais = '059';
ALTER TABLE customers MODIFY COLUMN pais VARCHAR(50) DEFAULT '222';
