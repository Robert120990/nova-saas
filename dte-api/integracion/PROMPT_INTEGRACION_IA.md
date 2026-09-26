# PROMPT DE INTEGRACIÓN DTE-API PARA INTELIGENCIA ARTIFICIAL (LLMs)

> **INSTRUCCIONES PARA LA INTELIGENCIA ARTIFICIAL (ChatGPT, Claude, Cursor, Copilot, DeepSeek, etc.):**
> Actúa como un Arquitecto de Software y Desarrollador Senior. Utiliza las especificaciones, reglas de arquitectura, contratos de datos, modelo de descuentos y ejemplos de este documento para implementar el módulo cliente, biblioteca o servicio de integración que conecte el sistema del usuario (ERP, CRM, POS, Ecommerce o App) con el microservicio **`dte-api`** (Facturación Electrónica de El Salvador — Normativa SVFE v2.0 del Ministerio de Hacienda).

---

## 1. RESUMEN DEL SISTEMA Y ARQUITECTURA

El microservicio `dte-api` es una pasarela fiscal autónoma desarrollada en Node.js/Express. Gestiona todo el ciclo de vida tributario:
1. **Estructuración Normativa:** Construye el JSON oficial según la normativa SVFE v2.0 del Ministerio de Hacienda (MH), validando tipos de datos, longitudes y reglas de negocio.
2. **Control de Correlativos:** Asigna correlativos oficiales (`numeroControl`) y genera el identificador único universal (`codigoGeneracion` UUID v4).
3. **Firma Digital Externa (.CRT):** Opera con `SIGNATURE_MODE=external` comunicándose localmente con el contenedor oficial Docker `svfe-api-firmador`. El certificado digital X.509 (`.crt` público y clave privada) y la contraseña (`passwordPri`) están configurados en el servidor. **Tu sistema externo NO manipula llaves criptográficas ni certificados**.
4. **Transmisión a Hacienda:** Envía el JWS firmado a los servidores de Hacienda y obtiene el **Sello de Recepción** oficial de 40 caracteres.
5. **Modo Contingencia Automático:** Si Hacienda está caído o en mantenimiento, `dte-api` conmuta automáticamente a transmisión diferida (`tipoOperacion: 2`), refirma el documento y lo almacena para retransmisión posterior, permitiendo que la venta física continúe sin interrupciones.
6. **Representación Gráfica:** Genera el PDF oficial reglamentario con sello y código QR verificable ante el portal de Hacienda.

---

## 2. PROTOCOLO DE AUTENTICACIÓN Y SEGURIDAD MULTI-TENANT

### 2.1 Especificación del Token JWT
Cada petición HTTP hacia `dte-api` debe incluir el encabezado:
```http
Authorization: Bearer <TOKEN_JWT>
Content-Type: application/json
```

El token JWT se genera con algoritmo **HS256** utilizando la clave secreta compartida (`JWT_SECRET` del servidor).

#### Payload (Claims Obligatorios):
| Campo | Tipo | Obligatorio | Descripción |
| :--- | :--- | :---: | :--- |
| `company_id` | Integer | **SÍ** | ID de la empresa en la base de datos (asocia NIT y certificados). |
| `branch_id` | Integer | **SÍ** | ID de la sucursal o punto de venta emisor. |
| `username` | String | **SÍ** | Identificador del sistema o usuario que emite (ej. `"pos_externo"`). |
| `id` | Integer | No | ID numérico del usuario en el sistema emisor (o `0`). |
| `exp` | Unix Timestamp | **SÍ** | Tiempo de expiración (recomendado: 15 a 60 minutos). |

> ⚠️ **REGLA CRÍTICA DE SEGURIDAD (ANTI-INYECCIÓN MULTI-TENANT):**
> **NUNCA** envíes `company_id` ni `branch_id` dentro del cuerpo JSON de la petición (`req.body`). Si `dte-api` detecta alguno de estos campos en el cuerpo, **rechazará la solicitud inmediatamente con error HTTP 400**. La empresa y sucursal autorizadas se resuelven **única y exclusivamente** desde los claims del token JWT verificado.

---

## 3. CATÁLOGO COMPLETO DE TIPOS DE DOCUMENTO ADMITIDOS

### 3.1 Tipos de Documentos Tributarios Electrónicos (CAT-002)
El microservicio `dte-api` tiene implementada la compatibilidad con todos los tipos de documentos tributarios de la normativa SVFE de El Salvador:

| Código | Nombre Oficial DTE | Versión Schema | Descripción y Casos de Uso | Requisitos Clave del Receptor / Emisión |
| :---: | :--- | :---: | :--- | :--- |
| **`01`** | **Factura** (Consumidor Final) | `v2` | Ventas al detalle a personas naturales o consumidores finales sin registro de IVA. Precios incluyen IVA. | Si el monto total es $\ge \$200.00$, es obligatorio documento de identidad (DUI/NIT/Pasaporte) y nombre completo. |
| **`03`** | **Comprobante de Crédito Fiscal** (CCF) | `v4` | Operaciones entre contribuyentes de IVA (B2B). Permite al receptor deducir crédito fiscal. | Requiere `nrc`, `codActividad` económica (CAT-019), `nombre` y documento fiscal (`nit`/`numDocumento`). Precios netos sin IVA. |
| **`04`** | **Nota de Remisión** | `v4` | Ampara el traslado físico y legal de mercaderías dentro del territorio nacional. | Requiere datos de transporte, conductor, placas y documento de recepción asociado. |
| **`05`** | **Nota de Crédito** | `v4` | Correcciones, devoluciones de mercaderías, descuentos posteriores o anulación parcial de Facturas o CCF previos. | Requiere bloque `documentoRelacionado` con el `codigoGeneracion` o número del documento original afectado. |
| **`06`** | **Nota de Débito** | `v4` | Cobro de intereses moratorios, ajustes de precio al alza o gastos no facturados previamente. | Requiere bloque `documentoRelacionado` indicando el documento base. |
| **`07`** | **Comprobante de Retención** | `v2` | Emisión obligatoria cuando un agente de retención retiene el 1% de IVA a proveedores en compras $\ge \$100.00$. | Receptor es el proveedor sujeto a retención. Detalla los documentos de compra sujetos a retención. |
| **`08`** | **Comprobante de Liquidación** | `v2` | Liquidación de operaciones por cuenta de terceros (consignaciones, intermediaciones o remates). | Detalla las ventas o liquidaciones realizadas a nombre de un tercero mandante. |
| **`09`** | **Documento Contable de Liquidación (DCLE)** | `v2` | Liquidaciones de cobros o pagos específicos regulados por el Código Tributario. | Liquidación de comisiones, servicios fiduciarios o intermediaciones financieras. |
| **`11`** | **Factura de Exportación (FEX)** | `v3` | Exportación definitiva de bienes y servicios hacia el exterior (tasa 0% IVA). | Receptor extranjero (`tipoDocumento: "37"` o `"03"`). Requiere `recintoFiscal`, `regimenExportacion`, país destino (`CAT-020`). |
| **`14`** | **Factura de Sujeto Excluido (FSE)** | `v2` | Compras de bienes o servicios a personas naturales domiciliadas en SV que no son contribuyentes de IVA. | Emisor liquida la compra al proveedor informal. Aplica retención del 10% de ISR sobre el valor contratado. |
| **`15`** | **Comprobante de Donación** | `v2` | Ampara donaciones recibidas por entidades sin fines de lucro autorizadas por el Ministerio de Hacienda. | Receptor donante calificado. Justifica la deducibilidad del gasto en Renta. |

#### Eventos Tributarios Especiales Soportados:
- **`16` — Evento de Invalidación (Anulación Fiscal):** `POST /api/invalidation/invalidate` (Schema `v3`). Anula legalmente un DTE sellado previamente en Hacienda.
- **`17` — Evento de Contingencia / Operaciones Especiales (EOP):** Schema `v1`. Agrupa y transmite los DTEs emitidos bajo contingencia.
- **`18` — Evento de Retorno de Exportación (ERET):** Schema `v1`. Registro de retorno de mercadería exportada.

---

### 3.2 Tipos de Documento de Identidad del Receptor (CAT-022)
`dte-api` acepta tanto los códigos numéricos oficiales del CAT-022 como los alias comunes:

| Código CAT-022 | Alias Aceptado | Tipo de Documento | Formato / Validación Oficial |
| :---: | :---: | :--- | :--- |
| **`13`** | `"DUI"` | Documento Único de Identidad | 8 dígitos + guión + 1 dígito de control (`00000000-0`). |
| **`36`** | `"NIT"` | Número de Identificación Tributaria | Formato tradicional (`0000-000000-000-0`) o DUI homologado (9 dígitos sin guiones). |
| **`02`** | `"CARNET RESIDENTE"` | Carnet de Residente | Extranjeros residentes legales en El Salvador. |
| **`03`** | `"PASAPORTE"` | Pasaporte | Clientes extranjeros no residentes. |
| **`37`** | `"OTRO"` | Otro documento de identificación | Obligatorio en Facturas de Exportación (FEX 11) para receptores foráneos. |

---

## 4. MODELO Y REGLAS DE DESCUENTOS EN DTE-API

`dte-api` soporta de forma nativa e integrada los dos esquemas de descuentos normativos permitidos por el Ministerio de Hacienda:

```
                                  ┌─────────────────────────────────────────────────────────────┐
                                  │                     MODELO DE DESCUENTOS                    │
                                  └──────────────────────────────┬──────────────────────────────┘
                                                                 │
                                ┌────────────────────────────────┴────────────────────────────────┐
                                ▼                                                                 ▼
                ┌───────────────────────────────┐                                 ┌───────────────────────────────┐
                │   1. DESCUENTO POR ÍTEM       │                                 │   2. DESCUENTO GLOBAL / GRAL  │
                │      (items[].montoDescu)     │                                 │       (descuento_general)     │
                ├───────────────────────────────┤                                 ├───────────────────────────────┤
                │ - Descuento en la línea.      │                                 │ - Descuento al pie total.     │
                │ - Reduce la base gravada del  │                                 │ - Aplica a la venta gravada   │
                │   ítem directamente.          │                                 │   remanente.                  │
                │ - Fórmula:                    │                                 │ - Se traslada al bloque       │
                │   (precioUni * cant) - descu  │                                 │   resumen.descuGravada.       │
                └───────────────────────────────┘                                 └───────────────────────────────┘
```

### 4.1 Descuento por Ítem (`items[].montoDescu`)
- **Campo:** `items[i].montoDescu` (Numérico $\ge 0.00$).
- **Ubicación:** Dentro de cada objeto del arreglo `items`.
- **Comportamiento Fiscal:**
  - **Factura (01):** El `precioUnitario` viene con IVA incluido. El descuento `montoDescu` se resta directamente del subtotal con IVA:
    $$\text{ventaGravada} = (\text{precioUnitario} \times \text{cantidad}) - \text{montoDescu}$$
  - **Crédito Fiscal (03):** Si el sistema emisor envía precios inclusive, `dte-api` divide tanto el precio como el `montoDescu` entre $1.13$ para que la regla estricta de Hacienda cuadre al centavo:
    $$\text{precioUnitarioNeto} = \frac{\text{precioUnitario}}{1.13}, \quad \text{montoDescuNeto} = \frac{\text{montoDescu}}{1.13}$$
    $$\text{ventaGravada} = (\text{precioUnitarioNeto} \times \text{cantidad}) - \text{montoDescuNeto}$$

---

### 4.2 Descuento General / Global (`descuento_general` o `descuentoGeneral`)
- **Campo en Payload:** `descuento_general` o `descuentoGeneral` (también aceptado dentro de `header.descuento_general`).
- **Porcentaje:** `porcentajeDescuento` o `porcentaje_descuento` (opcional). Si no se envía porcentaje pero hay `descuento_general > 0`, `dte-api` calcula automáticamente el porcentaje relativo:
  $$\text{porcentajeDescuento} = \text{round}\left(\frac{\text{descuentoGravada}}{\text{totalGravada}} \times 100\right)$$
- **Comportamiento Fiscal en el Bloque `resumen` Oficial:**
  - `totalDescu`: Sumatoria exacta de todos los descuentos de ítems + el descuento general:
    $$\text{totalDescu} = \sum \text{items.montoDescu} + \text{descuGravada} + \text{descuExenta} + \text{descuNoSuj}$$
  - `descuGravada`: Monto del descuento general aplicado a la porción gravada (en CCF 03 se netea entre $1.13$, en Factura 01 es inclusive).
  - `porcentajeDescuento`: Se traslada al campo oficial del resumen exigido por el schema JSON de Hacienda.
  - `subTotal`: Base imponible tras descontar el descuento general:
    $$\text{subTotal} = \text{subTotalVentas} - \text{descuGravada} - \text{descuExenta} - \text{descuNoSuj}$$
  - `totalPagar`: Monto final a pagar por el cliente considerando descuentos globales e IVA remanente.

---

## 5. ESPECIFICACIÓN DE ENDPOINTS Y CONTRATOS DE DATOS

### 5.1 Emisión Unificada de DTE (`POST /api/dte/emit`)
Realiza el ciclo completo: resuelve correlativos, valida esquemas, firma con el `.crt` en el firmador Docker y transmite a Hacienda.

#### A) Ejemplo Factura de Consumidor Final (`01`) con Descuento por Ítem y Descuento Global:
```json
{
  "tipoDte": "01",
  "descuento_general": 5.00,
  "porcentajeDescuento": 5.0,
  "receptor": {
    "nombre": "Carlos Alberto Gómez",
    "tipoDocumento": "13",
    "numDocumento": "05123456-7",
    "telefono": "78901234",
    "correo": "carlos.gomez@gmail.com",
    "departamento": "06",
    "municipio": "14",
    "direccion": "Colonia Escalón, Calle El Mirador #123"
  },
  "items": [
    {
      "tipoItem": 1,
      "cantidad": 2,
      "codigo": "PROD-001",
      "descripcion": "Aceite Sintético para Motor 5W30",
      "precioUni": 25.00,
      "montoDescu": 5.00,
      "ventaGravada": 45.00,
      "tributos": null
    },
    {
      "tipoItem": 1,
      "cantidad": 1,
      "codigo": "SERV-002",
      "descripcion": "Servicio de Cambio de Aceite y Filtro",
      "precioUni": 15.00,
      "montoDescu": 0.00,
      "ventaGravada": 15.00,
      "tributos": null
    }
  ],
  "pagos": [
    {
      "codigo": "01",
      "montoPago": 55.00
    }
  ]
}
```
*En este ejemplo: Subtotal ítems = $45 + 15 = $60. Descuento general = $5.00. Total a pagar = $55.00.*

---

#### B) Ejemplo Crédito Fiscal (`03`) con Descuento General y Retención de IVA:
```json
{
  "tipoDte": "03",
  "descuento_general": 10.00,
  "condicionOperacion": 1,
  "receptor": {
    "nombre": "DISTRIBUIDORA COMERCIAL S.A. DE C.V.",
    "tipoDocumento": "36",
    "numDocumento": "0614-120990-101-2",
    "nrc": "123456-7",
    "codActividad": "46900",
    "descActividad": "Venta al por mayor no especializada",
    "telefono": "22558899",
    "correo": "contabilidad@distribuidora.com",
    "departamento": "06",
    "municipio": "14",
    "direccion": {
      "departamento": "06",
      "municipio": "14",
      "complemento": "Boulevard Los Próceres #456"
    }
  },
  "items": [
    {
      "tipoItem": 1,
      "cantidad": 10,
      "codigo": "LUB-010",
      "descripcion": "Caja de Lubricante Industrial 15W40",
      "precioUni": 30.00,
      "montoDescu": 2.00,
      "tributos": ["20"]
    }
  ],
  "pagos": [
    {
      "codigo": "05",
      "montoPago": 314.14
    }
  ]
}
```

---

#### Posibles Respuestas de `/api/dte/emit`:

**A) Éxito — Aprobado y Sellado por Hacienda (HTTP 200):**
```json
{
  "success": true,
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "numeroControl": "DTE-01-M001P001-000000000000250",
  "contingency": false,
  "data": {
    "estado": "PROCESADO",
    "selloRecibido": "20261A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F",
    "fhProcesamiento": "21/09/2026 11:30:15",
    "clasificaMsg": "10",
    "codigoMsg": "001",
    "descripcionMsg": "RECIBIDO CON EXITO",
    "observaciones": []
  }
}
```

**B) Rechazo Tributario de Hacienda (HTTP 200 con `success: false`):**
```json
{
  "success": false,
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "numeroControl": "DTE-01-M001P001-000000000000250",
  "message": "Rechazado por Ministerio de Hacienda",
  "data": {
    "estado": "RECHAZADO",
    "codigoMsg": "103",
    "descripcionMsg": "El valor del campo tributos no coincide con la sumatoria gravada",
    "observaciones": [
      "Total IVA calculado difiere por más de $0.01 respecto a la base imponible neta"
    ]
  }
}
```

**C) Facturación en Modo Contingencia por Caída de Hacienda (HTTP 200 con `contingency: true`):**
```json
{
  "success": true,
  "codigoGeneracion": "E2B1C3D4-5F6A-7B8C-9D0E-1A2B3C4D5E6F",
  "numeroControl": "DTE-01-M001P001-000000000000251",
  "contingency": true,
  "message": "DTE firmado en contingencia (Hacienda fuera de línea). Encolado para envío posterior.",
  "data": {
    "estado": "CONTINGENCIA",
    "tipoContingencia": 1,
    "motivo": "No disponibilidad del sistema del Ministerio de Hacienda"
  }
}
```

---

### 5.2 Descarga de Representación Gráfica (PDF Oficial)
* **Método:** `GET`
* **Ruta:** `/api/dte/pdf/:codigoGeneracion`
* **Cabeceras:** `Authorization: Bearer <TOKEN_JWT>`
* **Respuesta Exitosa (HTTP 200):**
  * `Content-Type: application/pdf`
  * `Content-Disposition: inline; filename="DTE-01-M001P001-000000000000250.pdf"`
  * Retorna el flujo binario del documento con sello de recepción y código QR reglamentario.

---

### 5.3 Invalidación / Anulación Fiscal de DTE
* **Método:** `POST`
* **Ruta:** `/api/invalidation/invalidate`
* **Descripción:** Emite el Evento de Invalidación oficial (CAT-002: `16`), lo firma con el certificado `.crt` y lo transmite a Hacienda para anular el documento fiscal.

```json
{
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "tipoDte": "01",
  "motivo": "2",
  "responsable": {
    "nombre": "Roberto Henríquez",
    "tipoDoc": "13",
    "numDoc": "02345678-9"
  },
  "solicitante": {
    "nombre": "Carlos Alberto Gómez",
    "tipoDoc": "13",
    "numDoc": "05123456-7"
  }
}
```

---

### 5.4 Consulta de Estado en Hacienda
* **Método:** `GET`
* **Ruta:** `/api/dte/status/:codigoGeneracion`
* **Respuesta Exitosa (HTTP 200):**
```json
{
  "success": true,
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "estado": "PROCESADO",
  "selloRecibido": "20261A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F",
  "fhProcesamiento": "21/09/2026 11:30:15"
}
```

---

### 5.5 Healthcheck del Microservicio
* **Método:** `GET`
* **Ruta:** `/api/health` (No requiere token)
* **Respuesta Exitosa (HTTP 200):**
```json
{
  "status": "UP",
  "timestamp": "2026-09-22T17:00:00.000Z"
}
```

---

## 6. GUÍA DE IMPLEMENTACIÓN PARA LA IA (PASO A PASO)

Cuando el usuario te pida escribir el código de integración en cualquier lenguaje (TypeScript, Python, PHP, C#, Go, Java, etc.):

1. **Crea un SDK o Clase Cliente (`DteApiClient`):**
   - Configurable con: `baseUrl`, `jwtSecret`, `companyId`, `branchId`, `username`.
   - Método privado `generateToken()` que genere el JWT automáticamente con expiración de 15 minutos.
   - Gestión automática del encabezado `Authorization: Bearer <token>`.
2. **Soporta Descuentos Transparentemente:**
   - Permite agregar `montoDescu` por línea de ítem.
   - Permite configurar `descuento_general` y `porcentajeDescuento` al nivel superior del payload.
3. **Manejo de Errores Defensivo:**
   - Guarda el `codigoGeneracion` y `numeroControl` devueltos para vincular la venta con el DTE.
   - Si `response.contingency === true`, marca el documento como "En contingencia" para retransmisión automática.
   - Si `response.success === false`, expone las `observaciones` y `descripcionMsg` devueltas por Hacienda.

---

## 7. EJEMPLO DE CLIENTE LISTO PARA USAR EN TYPESCRIPT / NODE.JS

```typescript
import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';

export interface DteClientConfig {
  baseUrl: string;
  jwtSecret: string;
  companyId: number;
  branchId: number;
  username?: string;
}

export class DteApiClient {
  private http: AxiosInstance;
  private config: DteClientConfig;

  constructor(config: DteClientConfig) {
    this.config = {
      username: 'external_client',
      ...config
    };
    this.http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private generateToken(): string {
    const payload = {
      id: 1,
      username: this.config.username,
      company_id: this.config.companyId,
      branch_id: this.config.branchId
    };
    return jwt.sign(payload, this.config.jwtSecret, { expiresIn: '15m' });
  }

  public async emitDte(payload: Record<string, any>) {
    const token = this.generateToken();
    const response = await this.http.post('/api/dte/emit', payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  public async downloadPdf(codigoGeneracion: string): Promise<Buffer> {
    const token = this.generateToken();
    const response = await this.http.get(`/api/dte/pdf/${codigoGeneracion}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  }

  public async invalidateDte(payload: Record<string, any>) {
    const token = this.generateToken();
    const response = await this.http.post('/api/invalidation/invalidate', payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  public async getStatus(codigoGeneracion: string) {
    const token = this.generateToken();
    const response = await this.http.get(`/api/dte/status/${codigoGeneracion}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
}
```

---

## 8. EJEMPLO DE CLIENTE LISTO PARA USAR EN PYTHON

```python
import jwt
import requests
import datetime

class DteApiClient:
    def __init__(self, base_url: str, jwt_secret: str, company_id: int, branch_id: int, username: str = "external_python"):
        self.base_url = base_url.rstrip('/')
        self.jwt_secret = jwt_secret
        self.company_id = company_id
        self.branch_id = branch_id
        self.username = username

    def _get_headers(self) -> dict:
        payload = {
            "id": 1,
            "username": self.username,
            "company_id": self.company_id,
            "branch_id": self.branch_id,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        }
        token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def emit_dte(self, dte_data: dict) -> dict:
        url = f"{self.base_url}/api/dte/emit"
        response = requests.post(url, json=dte_data, headers=self._get_headers(), timeout=30)
        return response.json()

    def download_pdf(self, codigo_generacion: str) -> bytes:
        url = f"{self.base_url}/api/dte/pdf/{codigo_generacion}"
        response = requests.get(url, headers=self._get_headers(), timeout=30)
        response.raise_for_status()
        return response.content

    def invalidate_dte(self, invalidation_data: dict) -> dict:
        url = f"{self.base_url}/api/invalidation/invalidate"
        response = requests.post(url, json=invalidation_data, headers=self._get_headers(), timeout=30)
        return response.json()

    def get_status(self, codigo_generacion: str) -> dict:
        url = f"{self.base_url}/api/dte/status/{codigo_generacion}"
        response = requests.get(url, headers=self._get_headers(), timeout=30)
        return response.json()
```
