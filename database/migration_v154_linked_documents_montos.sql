-- Migration v154: Montos de retención en documentos vinculados (CR 07)
-- Permite reconstruir el Comprobante de Retención al retransmitir.

ALTER TABLE sales_linked_documents
  ADD COLUMN monto_sujeto DECIMAL(14,2) NULL DEFAULT NULL COMMENT 'Monto sujeto a retención',
  ADD COLUMN iva_retenido DECIMAL(14,2) NULL DEFAULT NULL COMMENT 'IVA retenido del documento',
  ADD COLUMN descripcion VARCHAR(255) NULL DEFAULT NULL COMMENT 'Descripción del ítem del CR';
