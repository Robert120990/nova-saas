# Reglas de Implementación de Catálogos (SaaS)

Para mantener la consistencia y escalabilidad del sistema, todos los nuevos catálogos y módulos de listado deben seguir estas reglas:

## 1. Backend (Controladores)
Todos los métodos `get` deben soportar:
- **Búsqueda**: Parámetro `search` que filtre por los campos principales (usando `LIKE %search%`).
- **Paginación**: Parámetros `page` (default 1) y `limit` (default 10).
- **Respuesta Estructurada**: Debe devolver un objeto con:
  ```json
  {
    "data": [...],
    "total": 100,
    "page": 1,
    "totalPages": 10
  }
  ```

## 2. Frontend (React)
- **Barra de Búsqueda**: Debe incluir un input con ícono `Search` y debounce de al menos 500ms.
- **Paginación**: Usar el componente reutilizable `<Pagination />`.
- **TanStack Query**: La `queryKey` debe incluir el término de búsqueda y la página actual para invalidación correcta: `['recurso', search, page]`.
- **Estado de Carga**: Pasar `isLoading` al componente `<Table />` para mostrar un spinner y evitar el mensaje de "No se encontraron registros" durante la carga inicial o búsqueda.
- **Dependencias Paginas**: Si un catálogo depende de otro (ej. Productos depende de Categorías), y el catálogo de dependencia también está paginado, asegurarse de extraer `.data` del resultado de la query.

## 3. UI/UX
- Los badges de **Estado** deben ser interactivos (si el negocio lo permite) para cambios rápidos sin abrir modales.
- Las tablas deben usar el componente `<Table />` estándar con encabezados en mayúsculas y fuente negrita.
- Los botones de acción deben incluir íconos claros (`Edit`, `Trash2`) con tooltips o colores distintivos.
