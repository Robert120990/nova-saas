CREATE TABLE IF NOT EXISTS customer_branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    company_id INT NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    departamento VARCHAR(10),
    municipio VARCHAR(10),
    direccion TEXT,
    telefono VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
