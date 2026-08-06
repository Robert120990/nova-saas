ALTER TABLE pos_shifts
    ADD COLUMN arqueado TINYINT(1) NOT NULL DEFAULT 0 AFTER total_remesas;

UPDATE pos_shifts SET arqueado = 1 WHERE status = 'closed';
