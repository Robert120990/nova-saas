# PROMPT DE INTEGRACIÓN DTE-API PARA INTELIGENCIA ARTIFICIAL (LLMs)

> **INSTRUCCIONES PARA LA INTELIGENCIA ARTIFICIAL (ChatGPT, Claude, Cursor, Copilot, DeepSeek, etc.):**
> Actúa como un Arquitecto de Software y Desarrollador Senior. Utiliza las especificaciones, reglas de arquitectura, contratos de datos y ejemplos de este documento para implementar el módulo cliente, biblioteca o servicio de integración que conecte el sistema del usuario (ERP, CRM, POS, Ecommerce o App) con el microservicio **`dte-api`** (Facturación Electrónica de El Salvador — Normativa SVFE v2.0).

---

## 1. RESUMEN DEL SISTEMA Y ARQUITECTURA

El microservicio `dte-api` es una pasarela fiscal autónoma desarrollada en Node.js/Express. Gestiona todo el ciclo de vida tributario:
1. Estructura el JSON oficial según la normativa SVFE v2.0 del Ministerio de Hacienda (MH).
2. Asigna correlativos oficiales (`numeroControl`) y genera el identificador único (`codigoGeneracion` UUID v4).
3. **Firma Digital Externa (.CRT):** El microservicio opera con `SIGNATURE_MODE=external` comunicándose localmente con el contenedor oficial Docker `svfe-api-firmador`. El certificado digital X.509 (`.crt` público y clave privada) y la contraseña (`passwordPri`) están configurados en el servidor. **Tu sistema externo NO manipula llaves criptográficas ni certificados**.
4. **Transmisión a Hacienda:** Envía el JWS firmado a los servidores de Hacienda y obtiene el **Sello de Recepción** oficial de 40 caracteres.
5. **Modo Contingencia Automático:** Si Hacienda está caído o en mantenimiento, `dte-api` conmuta automáticamente a transmisión diferida (`tipoOperacion: 2`), refirma el documento y lo almacena para retransmisión posterior, permitiendo que la venta continúe.
6. **Representación Gráfica:** Genera el PDF oficial reglamentario con sello y código QR.

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

## 3. CATÁLOGOS OFICIALES DE HACIENDA (REFERENCIA OBLIGATORIA)

Al generar los datos de la solicitud, utiliza los códigos normativos:

* **CAT-002: Tipo de Documento Tributario (`tipoDte`)**
  * `"01"`: Factura de Consumidor Final (clientes particulares).
  * `"03"`: Comprobante de Crédito Fiscal (clientes con registro NRC).
  * `"05"`: Nota de Crédito.
  * `"06"`: Nota de Débito.
  * `"11"`: Factura de Exportación.
  * `"14"`: Factura de Sujeto Excluido.

* **CAT-022: Tipo de Documento de Identidad del Receptor (`tipoDocumento`)**
  * `"13"`: DUI (Formato: `00000000-0`).
  * `"36"`: NIT (Formato: `0000-000000-000-0` o 9 dígitos).
  * `"02"`: Carnet de Residente.
  * `"03"`: Pasaporte (Extranjeros).
  * `"37"`: Otro.

* **CAT-008: Departamentos Principales (`departamento`)**
  * `"06"`: San Salvador | `"05"`: La Libertad | `"02"`: Santa Ana | `"12"`: San Miguel.

* **CAT-017: Forma de Pago (`pagos[].codigo`)**
  * `"01"`: Billetes y monedas (Efectivo).
  * `"02"`: Tarjeta de Débito.
  * `"03"`: Tarjeta de Crédito.
  * `"04"`: Cheque.
  * `"05"`: Transferencia / Depósito bancario.

* **CAT-024: Motivos de Invalidación (`motivo`)**
  * `"1"`: Rescisión de la operación.
  * `"2"`: Error en los datos del documento.
  * `"3"`: Otro motivo reglamentario.

---

## 4. ESPECIFICACIÓN DE ENDPOINTS Y CONTRATOS DE DATOS

### 4.1 Emisión Unificada de DTE
* **Método:** `POST`
* **Ruta:** `/api/dte/emit`
* **Descripción:** Realiza el ciclo completo sincrónico: asigna correlativo, firma con el `.crt` en el firmador Docker, valida esquemas y transmite a Hacienda.

#### Cuerpo de la Solicitud (`POST /api/dte/emit`):
```json
{
  "tipoDte": "01",
  "receptor": {
    "nombre": "Carlos Alberto Gómez",
    "tipoDocumento": "13",
    "numDocumento": "05123456-7",
    "telefono": "78901234",
    "correo": "cliente@correo.com",
    "departamento": "06",
    "municipio": "14",
    "direccion": "Colonia Escalón, Calle El Mirador #123"
  },
  "items": [
    {
      "tipoItem": 1,
      "cantidad": 2,
      "codigo": "SERV-001",
      "descripcion": "Mantenimiento Preventivo de Servidor",
      "precioUni": 50.00,
      "montoDescu": 0.00,
      "ventaGravada": 100.00,
      "tributos": null
    }
  ],
  "pagos": [
    {
      "codigo": "01",
      "montoPago": 113.00
    }
  ]
}
```
*(Para Crédito Fiscal `tipoDte: "03"`, el receptor requiere además `"nrc": "123456-7"` y `"codActividad": "62010"` según CAT-019).*

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
      "Total IVA calculado difiere por más de $0.01 respecto al 13%"
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
  "message": "DTE firmado en contingencia (Hacienda fuera de línea). Encolado para envío.",
  "data": {
    "estado": "CONTINGENCIA",
    "tipoContingencia": 1,
    "motivo": "No disponibilidad del sistema del Ministerio de Hacienda"
  }
}
```

**D) Error de Validación de Estructura / Faltan Campos (HTTP 400 Bad Request):**
```json
{
  "success": false,
  "message": "Error de validación del esquema DTE",
  "errors": [
    "items.0.precioUni must be a number",
    "receptor.departamento must be 2 characters"
  ]
}
```

---

### 4.2 Descarga de Representación Gráfica (PDF Oficial)
* **Método:** `GET`
* **Ruta:** `/api/dte/pdf/:codigoGeneracion`
* **Cabeceras:** `Authorization: Bearer <TOKEN_JWT>`
* **Respuesta Exitosa (HTTP 200):**
  * `Content-Type: application/pdf`
  * `Content-Disposition: inline; filename="DTE-01-M001P001-000000000000250.pdf"`
  * Cuerpo: Flujo binario del documento PDF listo para imprimir o enviar por correo.

---

### 4.3 Invalidación / Anulación Fiscal de DTE
* **Método:** `POST`
* **Ruta:** `/api/invalidation/invalidate`
* **Descripción:** Emite el Evento de Invalidación oficial, lo firma con el certificado `.crt` y lo transmite a Hacienda para anular el documento.

#### Cuerpo de la Solicitud (`POST /api/invalidation/invalidate`):
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

#### Respuesta Exitosa (HTTP 200):
```json
{
  "success": true,
  "codigoGeneracion": "F8D3B7A1-4E5C-6D7E-8F9A-0B1C2D3E4F5A",
  "codigoGeneracionEvento": "A1B2C3D4-E5F6-7890-ABCD-EF1234567890",
  "data": {
    "estado": "PROCESADO",
    "selloRecibido": "20268F7E6D5C4B3A2109876543210ABCDEF12345",
    "fhProcesamiento": "21/09/2026 11:45:00",
    "descripcionMsg": "RECIBIDO CON EXITO"
  }
}
```

---

### 4.4 Consulta de Estado en Hacienda
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

### 4.5 Healthcheck del Microservicio
* **Método:** `GET`
* **Ruta:** `/api/health` (No requiere token)
* **Respuesta Exitosa (HTTP 200):**
```json
{
  "status": "UP",
  "timestamp": "2026-09-21T17:30:00.000Z"
}
```

---

## 5. GUÍA DE IMPLEMENTACIÓN PARA LA IA (PASO A PASO)

Cuando el usuario te pida escribir el código de integración en cualquier lenguaje (TypeScript, Python, PHP, C#, Go, Java, etc.):

1. **Crea un SDK o Clase Cliente (`DteApiClient`):**
   * Configurable con: `baseUrl`, `jwtSecret`, `companyId`, `branchId`, `username`.
   * Un método privado `generateToken()` que genere el JWT automáticamente asegurando expiración de 15 minutos.
   * Gestión automática del encabezado `Authorization: Bearer <token>`.

2. **Implementa los métodos clave del cliente:**
   * `emitDte(dteData)` -> ejecuta `POST /api/dte/emit`.
   * `downloadPdf(codigoGeneracion)` -> ejecuta `GET /api/dte/pdf/:codigoGeneracion` devolviendo buffer/stream binario.
   * `invalidateDte(invalidationData)` -> ejecuta `POST /api/invalidation/invalidate`.
   * `checkStatus(codigoGeneracion)` -> ejecuta `GET /api/dte/status/:codigoGeneracion`.
   * `checkHealth()` -> ejecuta `GET /api/health`.

3. **Manejo de Errores Defensivo:**
   * Distingue entre fallas de red (timeout), rechazo de validación HTTP 400, y rechazo tributario oficial de Hacienda (`HTTP 200` con `success: false`).
   * Guarda el `codigoGeneracion` y `numeroControl` devueltos en la base de datos de la aplicación local para vincular la venta con el DTE.
   * Si `response.contingency === true`, marca la venta como "En contingencia" y notifica al usuario que se retransmitirá automáticamente.

---

## 6. EJEMPLO DE CLIENTE LISTO PARA USAR EN TYPESCRIPT / NODE.JS

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

## 7. EJEMPLO DE CLIENTE LISTO PARA USAR EN PYTHON

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
