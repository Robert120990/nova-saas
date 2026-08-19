-- Migration v142: entry_types globales (sin company_id)
-- Los tipos de partida pasan a ser compartidos por todas las empresas.
-- La FK de entry_types -> companies se elimina dinámicamente en el runner
-- (nombre de constraint auto-generado por MySQL).

-- 1) Quitar columna company_id
ALTER TABLE entry_types DROP COLUMN company_id;

-- 2) Remapear partidas que apuntan a tipos duplicados hacia el id superviviente (MIN(id))
UPDATE accounting_entries ae
JOIN entry_types et ON ae.entry_type_id = et.id
JOIN (
    SELECT * FROM (
        SELECT code, MIN(id) AS keep_id
        FROM entry_types
        GROUP BY code
        HAVING COUNT(*) > 1
    ) d
) dup ON dup.code = et.code
SET ae.entry_type_id = dup.keep_id;

-- 3) Eliminar tipos duplicados (se conserva el de menor id = los seeds de la empresa 1)
DELETE et FROM entry_types et
JOIN (
    SELECT * FROM (
        SELECT code, MIN(id) AS keep_id
        FROM entry_types
        GROUP BY code
        HAVING COUNT(*) > 1
    ) d
) dup ON dup.code = et.code
WHERE et.id <> dup.keep_id;

-- 4) Unicidad por código
ALTER TABLE entry_types ADD UNIQUE INDEX uq_entry_types_code (code);