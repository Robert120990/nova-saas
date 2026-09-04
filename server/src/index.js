require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');

const app = express();
app.set('trust proxy', 1);

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const certsDir = path.join(__dirname, '..', 'certificados-p12pfx');
const crtsDir = path.join(__dirname, '..', 'certificados-crt');

[uploadsDir, certsDir, crtsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// File logger setup
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = fs.createWriteStream(path.join(logsDir, 'server.log'), { flags: 'a' });
morgan.token('safe-url', (req) => (req.originalUrl || req.url).replace(/([?&])token=[^&]+/g, '$1token=***'));

app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]', { stream: { write: (msg) => logFile.write(msg) } }));

const _log = console.log;
const _error = console.error;
const _warn = console.warn;

const serializeLogArg = (arg) => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    try {
        const json = JSON.stringify(arg);
        return json !== undefined ? json : String(arg);
    } catch {
        try { return String(arg); } catch { return '[unserializable]'; }
    }
};

console.log = (...args) => { logFile.write(`[${new Date().toISOString()}] [LOG] ${args.map(serializeLogArg).join(' ')}\n`); _log.apply(console, args); };
console.error = (...args) => { logFile.write(`[${new Date().toISOString()}] [ERROR] ${args.map(serializeLogArg).join(' ')}\n`); _error.apply(console, args); };
console.warn = (...args) => { logFile.write(`[${new Date().toISOString()}] [WARN] ${args.map(serializeLogArg).join(' ')}\n`); _warn.apply(console, args); };

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan(':method :safe-url :status :response-time ms - :res[content-length]'));
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);

// Restart DTE API (reinicia proceso dte-api en puerto 5000)
app.post('/api/restart', express.json(), async (req, res) => {
    const key = req.body?.restart_key || req.headers['x-restart-key'];
    if (!key || key !== 'novarestart2026') {
        return res.status(401).json({ message: 'restart_key inválida' });
    }
    try {
        const response = await fetch('http://localhost:5000/api/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restart_key: key })
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(502).json({ message: 'Error conectando con dte-api: ' + e.message });
    }
});

app.use('/api', apiRoutes);

// Health check
const SERVER_VERSION = (() => {
    try {
        return require('child_process').execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
    } catch (e) {
        return 'unknown';
    }
})();

app.get('/health', (req, res) => {
    res.json({ status: 'OK', version: SERVER_VERSION, environment: process.env.NODE_ENV, timestamp: new Date() });
});

// Serve client built files in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/ws')) {
            res.sendFile(path.join(clientDist, 'index.html'));
        }
    });
}

// Error handler
app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    res.status(500).json({ 
        message: 'Error interno del servidor', 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const http = require('http');
const { initWebSocket } = require('./services/websocket.service');
const { startWorker } = require('./services/notificationWorker');
const { startBot: startTelegramBot } = require('./services/telegram.service');
const { startSuspiciousSalesDetector } = require('./services/suspiciousSalesDetector');

// Evitar que un error no capturado (unhandledRejection) tumbe el servidor
// a mitad de una respuesta: se registra la causa y el proceso sigue vivo.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection (no tumba el server):', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception (no tumba el server):', err);
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Inicializar el WebSocket acoplado al servidor HTTP con la versión del servidor
initWebSocket(server, SERVER_VERSION);

// Inicializar worker de notificaciones en segundo plano
startWorker();

server.listen(PORT, () => {
    console.log(`Servidor SaaS corriendo en puerto ${PORT}`);
    startTelegramBot();
    startSuspiciousSalesDetector();
});
