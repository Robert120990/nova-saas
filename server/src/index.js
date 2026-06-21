require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');

let gitCommit = 'unknown';
try {
    gitCommit = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
} catch (e) {}

const app = express();

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
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', version: gitCommit, environment: process.env.NODE_ENV, timestamp: new Date() });
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
