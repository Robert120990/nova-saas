ALTER TABLE sales_headers
  ADD UNIQUE KEY uq_sales_company_codigo_generacion (company_id, codigo_generacion),
  ADD INDEX idx_sales_company_numero_control (company_id, numero_control);
