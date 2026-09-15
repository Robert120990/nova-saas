# Regla Obligatoria: Claves de Permiso Únicas en Menú y Roles (`menu_items` & `permission_key`)

Este documento establece la regla arquitectónica estricta para la creación o modificación de opciones de menú y reportes en el sistema SaaS.

---

## 1. El Principio de Unicidad de Claves de Permiso (CRÍTICO)

En la pantalla de gestión de Roles (`client/src/pages/Roles.jsx`), la matriz de permisos se alimenta dinámicamente desde `menu_items` agrupando por clave de permiso (`permission_key`).
El hook `useMenuPermissions` realiza una deduplicación por clave:
```javascript
if (!seen[item.permission_key]) {
    seen[item.permission_key] = true;
    groups[groupId].permissions.push({ ... });
}
```

### Regla Fundamental:
> **Queda estrictamente PROHIBIDO reutilizar una clave de permiso (`permission_key`) existente para múltiples opciones de menú, pantallas secundarias o reportes.**
> 
> Si dos o más ítems en `menu_items` comparten la misma clave, **solo el primero se mostrará en Roles**, provocando que todas las demás opciones queden invisibles y no configurables para los roles de usuario.

---

## 2. Convención de Nomenclatura Estándar

Al crear o registrar cualquier ítem en `menu_items` (sea por migración o por el catálogo de menús), la clave `permission_key` debe seguir las siguientes nomenclaturas según el tipo de pantalla:

1. **Pantallas operativas, catálogos y transacciones:**
   - Prefijo: `manage_<modulo>_<accion_o_entidad>`
   - Ejemplos:
     - `manage_rh_acciones_personal`
     - `manage_accounting_contabilizar_ventas_compras`
     - `manage_accounting_correlativos`
     - `manage_purchase_checks`

2. **Reportes, libros e informes contables:**
   - Prefijo: `view_<modulo>_<nombre_reporte>_report` o `view_<modulo>_<nombre_reporte>`
   - Ejemplos:
     - `view_rh_isss_report`
     - `view_rh_afp_report`
     - `view_rh_renta_report`
     - `view_purchase_checks_report`
     - `view_inventory_valuation_report`
     - `view_accounting_balance_general`

3. **Permisos de visualización de dashboard o módulos:**
   - Prefijo: `view_<modulo>` (ej: `view_crm`, `view_notifications`).

---

## 3. Checklist Obligatorio al Crear un Nuevo Módulo o Reporte

Cada vez que se desarrolle una nueva opción de menú o reporte:

- [ ] **Ruta única:** Definir la ruta en `App.jsx` y su correspondiente entrada en `menu_items`.
- [ ] **Clave única:** Asignar un `permission_key` exclusivo y descriptivo que no exista en ningún otro registro de `menu_items`.
- [ ] **Detección automática de reportes:** Si la opción es un reporte, asegurarse de que su ruta contenga `/reportes/` o que su clave termine en `_report` para que `Roles.jsx` le asigne automáticamente el badge visual azul `[REPORTE]`.
- [ ] **Migración de base de datos con herencia:** En el script de migración que inserte el nuevo ítem, incluir la actualización de la tabla `roles` para añadir la nueva clave al menos a los roles administradores (`SuperAdmin`, `Admin`) o roles que tengan el permiso padre del módulo, evitando que los usuarios pierdan acceso a la nueva funcionalidad.
