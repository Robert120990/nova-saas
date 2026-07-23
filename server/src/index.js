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

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));
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
app.get('/health', (req, res) => {
    let version = 'unknown';
    try {
        version = require('child_process').execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
    } catch (e) {}
    res.json({ status: 'OK', version, environment: process.env.NODE_ENV, timestamp: new Date() });
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

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Inicializar el WebSocket acoplado al servidor HTTP
initWebSocket(server);

server.listen(PORT, () => {
    console.log(`Servidor SaaS corriendo en puerto ${PORT}`);
});
