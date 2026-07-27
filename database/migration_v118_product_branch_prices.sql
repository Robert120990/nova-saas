CREATE TABLE IF NOT EXISTS product_branch_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    precio_unitario DECIMAL(18,6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_branch (product_id, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario)
SELECT pb.product_id, pb.branch_id, p.precio_unitario
FROM product_branch pb
INNER JOIN products p ON pb.product_id = p.id
WHERE NOT EXISTS (
    SELECT 1 FROM product_branch_prices pbp
    WHERE pbp.product_id = pb.product_id AND pbp.branch_id = pb.branch_id
);

SELECT CONCAT('WARNING: Product ID ', p.id, ' (', p.codigo, ' - ', p.nombre, ') has precio_unitario = ', p.precio_unitario, ' but NO branch associations. Its price will be LOST.') AS warning
FROM products p
WHERE p.precio_unitario IS NOT NULL AND p.precio_unitario > 0
  AND NOT EXISTS (SELECT 1 FROM product_branch pb WHERE pb.product_id = p.id);

ALTER TABLE products DROP COLUMN precio_unitario;
