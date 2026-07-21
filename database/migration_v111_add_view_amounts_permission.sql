-- Migration v111: Add view_amounts permission to all non-SuperAdmin roles
-- Todos los roles existentes tendran view_amounts por defecto.
-- El administrador puede quitarlo del rol desde el panel de roles.

UPDATE roles
SET permissions = JSON_ARRAY_APPEND(permissions, '$', 'view_amounts')
WHERE id IN (2, 3, 4, 5, 7);
