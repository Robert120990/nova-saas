const express = require('express');
const router = express.Router();
const manualController = require('../controllers/manual.controller');
const { verifyToken } = require('../middlewares/auth');

router.get('/', verifyToken, manualController.getIndex);
router.get('/:section', verifyToken, manualController.getSection);

module.exports = router;
