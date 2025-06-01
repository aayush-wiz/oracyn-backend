const express = require('express');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

// Routes
router.get('/dashboard', analyticsController.getDashboard);
router.get('/queries', analyticsController.getQueryAnalytics);
router.get('/files', analyticsController.getFileAnalytics);
router.get('/usage', analyticsController.getUsageAnalytics);
router.get('/system', analyticsController.getSystemMetrics);

module.exports = router; 