# Reglas de Integración - DTE API

Esta guía define cómo interactuar con la API de DTE desde el sistema principal para garantizar una integración fluida y robusta.

## 1. Configuración de Red
La API de DTE corre de forma independiente.
- **Puerto por defecto**: `4005`
- **Base URL**: `http://localhost:4005/api`

## 2. Encabezados (Headers) Requeridos
Todas las peticiones (excepto `/health`) deben incluir:

| Header | Descripción | Obligatorio |
| :--- | :--- | :--- |
| `Authorization` | Token JWT obtenido del sistema principal (`Bearer <token>`) | Sí |
| `x-company-id` | ID de la empresa (Tenant) que emite el documento | Sí |
| `x-branch-id` | ID de la sucursal | No (opcional) |

## 3. Flujo de Trabajo Estándar
Para emitir un DTE correctamente, se debe seguir este orden:

1.  **Generar**: `POST /dte/generate` -> Crea el JSON base y lo guarda en `PENDING`.
2.  **Firmar**: `POST /dte/sign` -> Firma el JSON y cambia el estado a `SIGNED`.
3.  **Transmitir**: `POST /dte/transmit` -> Pone el documento en cola para envío a Hacienda.

## 4. Integración con POS

Para sistemas de Punto de Venta (POS), se recomienda utilizar el endpoint unificado de emisión automática:

**POST `/api/dte/emit`**

Este endpoint realiza todo el ciclo de vida en una sola llamada:
1. Generación de JSON y correlativos.
2. Validación de esquema.
3. Firma digital (según modo configurado).
4. Transmisión a Hacienda.

Cualquier error en la firma o transmisión de red que no sea falla de Hacienda (ej. certificado vencido) retornará un error inmediato. Fallas de red de Hacienda activarán el modo contingencia automáticamente.

---

### Endpoints Técnicos (Debugging)

## 5. Referencia de Endpoints

### 🟢 Generar DTE
`POST /dte/generate`
**Cuerpo (Payload):**
```json
{
  "tipoDte": "03",
  "receptor": {
    "nombre": "CLIENTE EJEMPLO SA DE CV",
    "nit": "0614-000000-000-0",
    "nrc": "00000-0",
    "direccion": {
      "departamento": "06",
      "municipio": "14",
      "complemento": "San Salvador, El Salvador"
    }
  },
  "items": [
    {
      "codigo": "PROD-001",
      "descripcion": "Producto de Prueba",
      "cantidad": 1,
      "precioUnitario": 10.00,
      "tipoItem": 1
    }
  ]
}
```

### 🔵 Firmar DTE
`POST /dte/sign`
**Cuerpo:**
```json
{
  "codigoGeneracion": "UUID-DEL-PASO-ANTERIOR",
  "password": "CLAVE_OPCIONAL_SI_NO_ESTA_EN_BD"
}
```
*Nota: La API ahora firma internamente usando el certificado configurado en la base de datos para la empresa.*

### 🚀 Transmitir a Hacienda
`POST /dte/transmit`
**Cuerpo:**
```json
{
  "codigoGeneracion": "UUID-DEL-DTE"
}
```

### 📄 Obtener Representación Impresa (PDF)
`GET /dte/pdf/{codigoGeneracion}`
- Devuelve un flujo binario `application/pdf`.

## 5. Manejo de Errores
La API devuelve errores en formato estandarizado:
```json
{
  "success": false,
  "message": "Mensaje legible del error",
  "details": [] 
}
```

## 6. Estados del DTE
- `PENDING`: Generado pero sin firma.
- `SIGNED`: Firmado satisfactoriamente.
- `SENT`: En cola de transmisión o enviado.
- `ACCEPTED`: Aceptado por el Ministerio de Hacienda (Sello recibido).
- `REJECTED`: Rechazado por Hacienda (Ver `dte_errors`).
- `ERROR`: Fallo técnico en el proceso.
