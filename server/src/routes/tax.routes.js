const express = require('express');
const router = express.Router();
const { getTaxConfig, updateTaxConfig } = require('../controllers/tax.controller');

// Obtener la configuración de impuestos de la empresa logueada
router.get('/', getTaxConfig);

// Actualizar la configuración de impuestos
router.put('/', updateTaxConfig);

module.exports = router;
