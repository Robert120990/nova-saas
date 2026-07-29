# Configuración

Ajustes del sistema y configuraciones generales.

## Configuración del Sistema

1. Vaya a **Configuración > Configuración del Sistema**
2. Configure:
   - **Nombre del sistema**
   - **Parámetros fiscales** por defecto
   - **Porcentajes de IVA** por defecto
   - **Configuración de ventas** (tipo de documento por defecto)
   - **Límites y validaciones**

## Configuración SMTP

Configure el servidor de correo para envío de:
- Notificaciones por email
- Reportes programados
- Recuperación de contraseña

**Campos:**
- Host del servidor SMTP
- Puerto (25, 465, 587)
- Seguridad (SSL/TLS)
- Usuario y contraseña
- Correo remitente

## Notificaciones

Gestión de canales de notificación:
- **Notificaciones en sistema** — Campana de notificaciones
- **Correo electrónico** — Alertas por email
- **WhatsApp** — Mensajes a través de WhatsApp

### Tipos de notificación
- Ventas realizadas
- DTE rechazados
- Productos con bajo stock
- Vencimientos próximos

## WhatsApp

Configure la integración con WhatsApp Business API:
- Número de teléfono
- Token de API
- Mensajes automáticos (confirmación de venta, recordatorios de pago)

## Roles y Usuarios

Administración de seguridad del sistema.

### Usuarios
- **Crear**: username, nombre, email, contraseña
- **Asignar roles**: cada usuario puede tener un rol por empresa
- **Activar/Desactivar**: control de acceso

### Roles
- **SuperAdmin** — Acceso total al sistema
- **Roles personalizados**: cree roles con permisos específicos
- Asigne permisos marcando las casillas en el editor de roles

### Bitácora del Sistema
Registro de todas las acciones importantes en el sistema:
- Inicios de sesión
- Creación/edición/eliminación de registros
- Cambios de configuración
- Errores del sistema

### Usuarios Conectados
Visualice los usuarios activos actualmente en el sistema.

## Visor de Logs
Consulte los archivos de log del servidor para diagnóstico de errores.
