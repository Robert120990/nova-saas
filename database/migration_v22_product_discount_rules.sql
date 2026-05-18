-- Migration: Product Discount Rules
-- Allows defining discounts (percentage or fixed amount) for specific products
-- with optional start/end dates

CREATE TABLE IF NOT EXISTS product_discount_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    product_id INT NOT NULL,
    discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_active (product_id, active),
    INDEX idx_company (company_id)
);
