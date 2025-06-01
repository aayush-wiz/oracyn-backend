const express = require('express');
const { body } = require('express-validator');
const queryController = require('../controllers/queryController');

const router = express.Router();

// Validation rules
const queryValidation = [
  body('query').trim().isLength({ min: 1 }).withMessage('Query is required'),
  body('fileIds').optional().isArray().withMessage('File IDs must be an array'),
];

// Routes
router.post('/', queryValidation, queryController.submitQuery);
router.get('/history', queryController.getQueryHistory);
router.get('/stats/summary', queryController.getQueryStats);
router.get('/:queryId', queryController.getQueryById);
router.delete('/:queryId', queryController.deleteQuery);
router.delete('/history', queryController.clearQueryHistory);

module.exports = router; 