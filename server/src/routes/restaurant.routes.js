const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const tenantMiddleware = require('../middlewares/tenant');
const restaurantController = require('../controllers/restaurant.controller');

// Todos los endpoints de restaurante requieren autenticación de usuario y tenant de empresa
router.use(verifyToken);
router.use(tenantMiddleware);

// --- COMANDAS (ORDERS) ---
router.get('/orders', restaurantController.getOrders);
router.get('/orders/:id', restaurantController.getOrderById);
router.post('/orders', restaurantController.createOrder);
router.post('/orders/:id/items', restaurantController.addItemsToOrder);
router.put('/orders/:id/fire-course', restaurantController.fireCourse);
router.put('/orders/:id/items/:itemId/cancel', restaurantController.cancelOrderItem);
router.put('/orders/:id/tip', restaurantController.updateTip);
router.put('/orders/:id/close', restaurantController.closeOrder);
router.post('/orders/:id/split', restaurantController.splitOrder);
router.put('/orders/:id/discount', restaurantController.applyOrderDiscount);
router.put('/orders/:id/items/:itemId/discount', restaurantController.applyItemDiscount);

// --- MESEROS Y CIERRE DE TURNO (WAITERS & SHIFT) ---
router.get('/waiters', restaurantController.getWaitersList);
router.get('/waiters/shift-summary', restaurantController.getWaiterShiftSummary);

// --- MESAS Y ÁREAS (TABLES & AREAS) ---
router.get('/areas', restaurantController.getAreas);
router.post('/areas', restaurantController.createArea);
router.put('/areas/:id', restaurantController.updateArea);
router.delete('/areas/:id', restaurantController.deleteArea);

router.get('/tables', restaurantController.getTables);
router.post('/tables', restaurantController.createTable);
router.put('/tables/:id', restaurantController.updateTable);
router.delete('/tables/:id', restaurantController.deleteTable);

router.post('/tables/transfer', restaurantController.transferTable);
router.post('/tables/merge', restaurantController.mergeTables);

// --- ESTACIONES DE COCINA (STATIONS) ---
router.get('/stations', restaurantController.getStations);
router.post('/stations', restaurantController.createStation);
router.put('/stations/:id', restaurantController.updateStation);
router.delete('/stations/:id', restaurantController.deleteStation);

// --- MODIFICADORES Y TÉRMINOS (MODIFIERS) ---
router.get('/modifiers/groups', restaurantController.getModifierGroups);
router.post('/modifiers/groups', restaurantController.createModifierGroup);
router.put('/modifiers/groups/:id', restaurantController.updateModifierGroup);
router.delete('/modifiers/groups/:id', restaurantController.deleteModifierGroup);

// --- CONFIGURACIÓN Y PROPINAS (CONFIG) ---
router.get('/config', restaurantController.getConfig);
router.put('/config', restaurantController.updateConfig);

// --- PANTALLA KDS DE COCINA (KDS) ---
router.get('/kds/orders', restaurantController.getKdsOrders);
router.put('/kds/orders/:id/items/:itemId/status', restaurantController.updateItemStatus);
router.put('/kds/orders/:id/status', restaurantController.updateOrderStatus);
router.get('/kds/unavailable-products', restaurantController.getUnavailableProducts);
router.post('/kds/toggle-product-86', restaurantController.toggleProduct86);

module.exports = router;
