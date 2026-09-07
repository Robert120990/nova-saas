# Git Workflow & Commit Rules

## Reglas Obligatorias de Control de Versiones (Git)

### 1. Mensajes de Commit Exclusivamente en Español
- Todos los commits generados en este proyecto DEBEN redactarse en **idioma español**.
- Se recomienda el formato de commits semánticos con descripción clara en español:
  - `feat: <descripción de la nueva funcionalidad en español>`
  - `fix: <descripción de la corrección del problema en español>`
  - `refactor: <descripción del cambio estructural en español>`
  - `docs: <descripción de cambios en documentación en español>`
  - `style: <cambios de formato o estilos visuales en español>`
  - `test: <adición o actualización de pruebas en español>`
  - `chore: <tareas de mantenimiento o configuración en español>`
- **Restricción estricta**: Queda prohibido redactar mensajes de commit en inglés (por ejemplo, evitar `fix bug`, `update components`, `add feature`; en su lugar usar `fix: corregir error en reportes`, `feat: agregar formato cuenta`, etc.).

### 2. Verificación Previa Obligatoria antes de `git push`
- Antes de ejecutar cualquier comando `git push` hacia el repositorio remoto (GitHub / origin):
  1. **Consultar cambios remotos**: Ejecutar obligatoriamente `git fetch origin` (o la rama de trabajo correspondiente) para conocer el estado actual de GitHub.
  2. **Verificar divergencias**: Comprobar el estado con `git status` o inspeccionando si hay commits remotos no integrados (`git log HEAD..origin/<rama>`).
  3. **Sincronizar si hay cambios**: Si la rama local se encuentra por detrás del remoto (`behind`), se DEBE ejecutar `git pull --rebase origin <rama>` (o `git pull origin <rama>`) y resolver cualquier conflicto de fusión antes de intentar publicar cambios.
  4. **Ejecutar push**: Únicamente cuando la rama local esté sincronizada, limpia y sin conflictos con GitHub, proceder con el `git push`.
