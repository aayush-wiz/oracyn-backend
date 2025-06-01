const express = require('express');
const multer = require('multer');
const fileController = require('../controllers/fileController');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,doc,txt,csv').split(',');
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${fileExtension} not allowed`), false);
    }
  },
});

// Routes
router.post('/upload', upload.array('files', 10), fileController.uploadFiles);
router.get('/', fileController.getFiles);
router.post('/reprocess', fileController.reprocessFiles);
router.get('/:fileId/status', fileController.getFileStatus);
router.delete('/:fileId', fileController.deleteFile);

module.exports = router; 