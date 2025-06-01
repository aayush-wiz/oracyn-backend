const express = require('express');
const { body } = require('express-validator');
const analysisController = require('../controllers/analysisController');

const router = express.Router();

// Validation rules
const analysisValidation = [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('type').isIn(['query_result', 'document_summary', 'custom']).withMessage('Invalid analysis type'),
  body('data').isObject().withMessage('Analysis data must be an object'),
];

// Routes
router.post('/', analysisValidation, analysisController.saveAnalysis);
router.get('/', analysisController.getAnalyses);
router.get('/stats/summary', analysisController.getAnalysisStats);
router.get('/export', analysisController.exportAllAnalyses);
router.get('/:analysisId', analysisController.getAnalysisById);
router.patch('/:analysisId', analysisController.updateAnalysis);
router.delete('/:analysisId', analysisController.deleteAnalysis);
router.get('/:analysisId/export', analysisController.exportAnalysis);

module.exports = router; 