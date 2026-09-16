const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middlewares/auth');
const terminalController = require('../controllers/terminal.controller');

// Todas las rutas de terminal requieren autenticación y permiso 'manage_server_terminal' (o SuperAdmin)
router.use(verifyToken);
router.use(checkPermission('manage_server_terminal'));

// Obtener estado y especificaciones del servidor
router.get('/system-info', terminalController.getSystemInfo);

// Ejecutar comando local en el host
router.post('/execute', terminalController.executeCommand);

// Probar conexión SSH remota
router.post('/ssh-test', terminalController.testSshConnection);

// Ejecutar comando vía SSH remoto
router.post('/ssh-execute', terminalController.executeSsh);

module.exports = router;
