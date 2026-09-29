# Conector Local Marcador Digital ZKTeco — SIPE WEB NOVASAAS

Este conector permite al sistema SIPE WEB en la nube (`https://sys.sipesv.com` o servidor local) comunicarse de forma segura con el **Reloj Marcador Digital / Biométrico ZKTeco** ubicado en la red local de la empresa (`192.168.3.201:4370`), sin necesidad de abrir puertos en el router ni configurar IP pública fija.

---

## 📋 Requisitos Previos

1. **Computadora en la Red Local (LAN)**: Cualquier computadora con Windows o Linux conectada a la misma red local del reloj marcador (debe responder `ping 192.168.3.201`).
2. **Node.js**: Versión 18, 20 o superior instalada (descargar gratis desde [nodejs.org](https://nodejs.org)).
3. **Acceso a Internet**: Salida HTTPS hacia el servidor SIPE WEB.

---

## 🚀 Puesta en Marcha Rápida (1 Minuto)

1. Coloque esta carpeta (`biometric-agent`) en la PC de la oficina o recepción (ejemplo: `C:\biometric-agent`).
2. Puede descargar el archivo `config.json` preconfigurado directamente desde la pantalla **Recursos Humanos > Marcador Digital > Conector Local** en SIPE WEB. O copie `config.json.example` a `config.json` y configure:
   ```json
   {
     "serverUrl": "https://sys.sipesv.com",
     "companyId": 1,
     "deviceId": 1,
     "agentKey": "PEGAR_CLAVE_AQUI",
     "deviceIp": "192.168.3.201",
     "devicePort": 4370,
     "commKey": 0,
     "protocol": "tcp",
     "syncIntervalSeconds": 30,
     "realTimeEnabled": true
   }
   ```
3. Haga doble clic en **`iniciar-conector.bat`**.
4. Verá en pantalla:
   ```
   [INFO] ✅ Conexión establecida con el Marcador Digital ZKTeco (192.168.3.201)
   [INFO] ✅ Estado [ONLINE] reportado al servidor SIPE SaaS.
   [INFO] Modo de escucha en tiempo real activado.
   ```
5. ¡Listo! A partir de ese momento, cada vez que un empleado marque con huella, rostro o tarjeta, la marcación se registrará al instante en SIPE WEB.

---

## 🔄 Ejecución Permanente en Segundo Plano

Para que el conector inicie automáticamente al encender la computadora:

### Opción A: Carpeta de Inicio de Windows (Más Fácil)
1. Presione `Win + R`, escriba `shell:startup` y presione Enter.
2. Cree un acceso directo a `iniciar-conector.bat` en esa carpeta.
3. En las propiedades del acceso directo, seleccione **Ejecutar: Minimizada**.

### Opción B: Tarea Programada de Windows (Servicio Silencioso)
1. Abra el **Programador de Tareas** (`taskschd.msc`).
2. Cree una tarea básica con el desencadenador *Al iniciar el equipo* ejecutando `node.exe biometric-agent.js` en la carpeta `C:\biometric-agent`.
