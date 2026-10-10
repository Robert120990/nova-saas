-- Migración v263: Traslado de valores POS ingresados en Remesas y Gastos hacia Tarjetas
-- Traslada registros de pos_shift_expenses y pos_shift_remesas con descripción de POS/Tarjeta a pos_shift_tarjetas
-- y actualiza los totales consolidados en pos_shifts.

-- 1. Insertar en pos_shift_tarjetas desde pos_shift_expenses
INSERT INTO pos_shift_tarjetas (shift_id, num_tarjeta, num_autorizacion, description, amount, created_at)
SELECT 
    shift_id, 
    '', 
    '', 
    TRIM(description), 
    amount, 
    created_at
FROM pos_shift_expenses
WHERE (UPPER(description) LIKE '%POS%' OR UPPER(description) LIKE '%TARJETA%' OR UPPER(description) LIKE '%CREDOMATIC%' OR UPPER(description) LIKE '%VOUCHER%')
  AND UPPER(description) NOT LIKE '%PUNTOS%';

-- 2. Insertar en pos_shift_tarjetas desde pos_shift_remesas
INSERT INTO pos_shift_tarjetas (shift_id, num_tarjeta, num_autorizacion, description, amount, created_at)
SELECT 
    shift_id, 
    '', 
    '', 
    TRIM(description), 
    amount, 
    created_at
FROM pos_shift_remesas
WHERE (UPPER(description) LIKE '%POS%' OR UPPER(description) LIKE '%TARJETA%' OR UPPER(description) LIKE '%CREDOMATIC%' OR UPPER(description) LIKE '%VOUCHER%' OR UPPER(TRIM(description)) = 'BAC');

-- 3. Eliminar de pos_shift_expenses los registros trasladados
DELETE FROM pos_shift_expenses
WHERE (UPPER(description) LIKE '%POS%' OR UPPER(description) LIKE '%TARJETA%' OR UPPER(description) LIKE '%CREDOMATIC%' OR UPPER(description) LIKE '%VOUCHER%')
  AND UPPER(description) NOT LIKE '%PUNTOS%';

-- 4. Eliminar de pos_shift_remesas los registros trasladados
DELETE FROM pos_shift_remesas
WHERE (UPPER(description) LIKE '%POS%' OR UPPER(description) LIKE '%TARJETA%' OR UPPER(description) LIKE '%CREDOMATIC%' OR UPPER(description) LIKE '%VOUCHER%' OR UPPER(TRIM(description)) = 'BAC');

-- 5. Recalcular totales consolidados en pos_shifts
UPDATE pos_shifts s
LEFT JOIN (
    SELECT shift_id, COALESCE(SUM(amount), 0) as total FROM pos_shift_expenses GROUP BY shift_id
) e ON e.shift_id = s.id
LEFT JOIN (
    SELECT shift_id, COALESCE(SUM(amount), 0) as total FROM pos_shift_remesas GROUP BY shift_id
) r ON r.shift_id = s.id
LEFT JOIN (
    SELECT shift_id, COALESCE(SUM(amount), 0) as total FROM pos_shift_tarjetas GROUP BY shift_id
) t ON t.shift_id = s.id
SET 
    s.total_expenses = COALESCE(e.total, 0),
    s.total_remesas = COALESCE(r.total, 0),
    s.total_tarjetas = COALESCE(t.total, 0);
