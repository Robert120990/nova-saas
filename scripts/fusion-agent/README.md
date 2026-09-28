# Conector Local Wayne Fusion FFC — SIPE WEB NOVASAAS

Este conector permite al sistema SaaS en la nube (`https://sys.sipesv.com`) consultar de forma segura los turnos y totalizadores del controlador **Wayne Fusion FFC** ubicado en la red local de la estación de servicio (`https://10.19.4.15`), sin necesidad de abrir puertos en el router ni configurar IP pública o DDNS.

---

## 📋 Requisitos Previos

1. **Computadora en la Estación**: Cualquier PC que esté conectada a la misma red local (LAN o WiFi) del controlador Fusion FFC (debe responder `ping 10.19.4.15`).
2. **Node.js**: Versión 20 o superior instalada (descargar gratis desde [nodejs.org](https://nodejs.org)).
3. **Acceso a Internet**: Salida HTTPS a `sys.sipesv.com` (puerto 443 estándar).

---

## 🚀 Puesta en Marcha Rápida (1 Minuto)

1. Coloque esta carpeta (`fusion-agent`) en la PC de la estación (por ejemplo en `C:\fusion-agent`).
2. Edite el archivo `config.json` con los datos de su estación:
   ```json
   {
     "serverUrl": "https://sys.sipesv.com",
     "companyId": 1,
     "branchId": 2,
     "agentKey": "PEGAR_CLAVE_AQUI",
     "fusionHost": "https://10.19.4.15",
     "fusionUser": "MANAGER",
     "fusionPassword": "TU_PASSWORD"
   }
   ```
   *(La clave `agentKey` se obtiene directamente desde la pantalla de Configuración Fusion en el sistema SaaS)*.
3. Haga doble clic en **`iniciar-agente.bat`**.
4. Verá el mensaje:
   ```
   [INFO] ✅ Conexión establecida con https://sys.sipesv.com (Canal Seguro Activo)
   [INFO] 🟢 Conector en línea listo para recibir consultas desde la nube.
   ```
5. ¡Listo! A partir de ese momento, cada vez que cualquier usuario abra la importación de lecturas en SIPE WEB, las consultas viajarán instantáneamente por este canal seguro.

---

## 🔄 Ejecución Permanente en Segundo Plano

Para que el conector inicie automáticamente al encender la computadora:

### Opción 1: Carpeta de Inicio de Windows (Más Fácil)
1. Presione `Win + R`, escriba `shell:startup` y presione Enter.
2. Cree un acceso directo a `iniciar-agente.bat` en esa carpeta.
3. En las propiedades del acceso directo, puede seleccionar **Ejecutar: Minimizada**.

### Opción 2: Tarea Programada de Windows (Sin Ventana)
1. Abra el **Programador de Tareas** de Windows (`taskschd.msc`).
2. Cree una tarea básica:
   - Nombre: `Wayne Fusion SIPE Connector`
   - Desencadenador: `Al iniciar sesión` o `Al iniciar el equipo`.
   - Acción: `Iniciar un programa`.
   - Programa/script: `node.exe`
   - Argumentos: `fusion-agent.js`
   - Iniciar en: `C:\fusion-agent`
