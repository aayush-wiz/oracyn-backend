const { v4: uuidv4 } = require('uuid');
const { Storage } = require('@google-cloud/storage');
const { getDB } = require('../config/firebase');
const logger = require('../utils/logger');
const axios = require('axios');

// Configure Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

class FileController {
  // Upload files
  async uploadFiles(req, res) {
    try {
      const files = req.files;
      const userId = req.user.id;
      const db = getDB();
      const uploadedFiles = [];

      for (const file of files) {
        const fileId = uuidv4();
        const fileName = `${userId}/${fileId}/${file.originalname}`;
        
        // Upload to Google Cloud Storage
        const blob = bucket.file(fileName);
        const stream = blob.createWriteStream({
          metadata: {
            contentType: file.mimetype,
          },
        });

        await new Promise((resolve, reject) => {
          stream.on('error', reject);
          stream.on('finish', resolve);
          stream.end(file.buffer);
        });

        // Store metadata in Firestore
        const fileMetadata = {
          id: fileId,
          originalName: file.originalname,
          fileName: fileName,
          mimeType: file.mimetype,
          size: file.size,
          userId: userId,
          uploadedAt: new Date(),
          status: 'uploaded',
          processingStatus: 'pending',
          gcsPath: fileName,
        };

        await db.collection('files').doc(fileId).set(fileMetadata);
        uploadedFiles.push(fileMetadata);

        // Emit socket event for real-time updates
        const io = req.app.get('io');
        io.to(`user_${userId}`).emit('file_uploaded', {
          fileId,
          fileName: file.originalname,
          status: 'uploaded'
        });
      }

      // Process files through AI services after successful upload
      try {
        await this.processFilesInAI(uploadedFiles, userId, req);
      } catch (aiError) {
        logger.error('AI processing error:', aiError);
        // Continue with upload success even if AI processing fails
        // Files can be processed later
      }

      logger.info(`User ${userId} uploaded ${files.length} files`);

      res.json({
        success: true,
        message: `${files.length} files uploaded successfully`,
        files: uploadedFiles,
      });
    } catch (error) {
      logger.error('File upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload files',
        error: error.message,
      });
    }
  }

  // Helper method to process files in AI services
  async processFilesInAI(files, userId, req) {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const db = getDB();
    const io = req.app.get('io');

    for (const fileMetadata of files) {
      try {
        // Update processing status
        await db.collection('files').doc(fileMetadata.id).update({
          processingStatus: 'processing',
          processingStartedAt: new Date(),
        });

        // Emit processing started event
        io.to(`user_${userId}`).emit('file_processing_started', {
          fileId: fileMetadata.id,
          fileName: fileMetadata.originalName,
          status: 'processing'
        });

        // Download file from GCS to send to AI service
        const blob = bucket.file(fileMetadata.gcsPath);
        const [fileBuffer] = await blob.download();

        // Create form data for file upload to AI service
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('files', fileBuffer, {
          filename: fileMetadata.originalName,
          contentType: fileMetadata.mimeType
        });

        // Add metadata
        const metadata = {
          file_id: fileMetadata.id,
          user_id: userId,
          original_name: fileMetadata.originalName,
          upload_date: fileMetadata.uploadedAt.toISOString()
        };
        form.append('metadata', JSON.stringify(metadata));

        // Send to AI service
        const aiResponse = await axios.post(
          `${aiServiceUrl}/api/v1/documents/upload`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              ...(process.env.AI_SERVICE_API_KEY && {
                Authorization: `Bearer ${process.env.AI_SERVICE_API_KEY}`
              })
            },
            timeout: 300000, // 5 minutes timeout for large files
          }
        );

        // Update file status on success
        await db.collection('files').doc(fileMetadata.id).update({
          processingStatus: 'completed',
          processingCompletedAt: new Date(),
          aiProcessingResult: aiResponse.data,
          vectorized: true
        });

        // Emit processing completed event
        io.to(`user_${userId}`).emit('file_processing_completed', {
          fileId: fileMetadata.id,
          fileName: fileMetadata.originalName,
          status: 'completed',
          result: aiResponse.data
        });

        logger.info(`File ${fileMetadata.id} processed successfully in AI service`);

      } catch (aiError) {
        logger.error(`AI processing failed for file ${fileMetadata.id}:`, aiError.response?.data || aiError.message);

        // Update file status on error
        await db.collection('files').doc(fileMetadata.id).update({
          processingStatus: 'failed',
          processingCompletedAt: new Date(),
          processingError: aiError.response?.data?.detail || aiError.message
        });

        // Emit processing failed event
        io.to(`user_${userId}`).emit('file_processing_failed', {
          fileId: fileMetadata.id,
          fileName: fileMetadata.originalName,
          status: 'failed',
          error: aiError.response?.data?.detail || aiError.message
        });

        throw aiError; // Re-throw to be caught by caller
      }
    }
  }

  // Get user files
  async getFiles(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;
      const db = getDB();

      const filesSnapshot = await db.collection('files')
        .where('userId', '==', userId)
        .orderBy('uploadedAt', 'desc')
        .limit(parseInt(limit))
        .offset((parseInt(page) - 1) * parseInt(limit))
        .get();

      const files = [];
      filesSnapshot.forEach(doc => {
        files.push({ id: doc.id, ...doc.data() });
      });

      const totalSnapshot = await db.collection('files')
        .where('userId', '==', userId)
        .get();

      res.json({
        success: true,
        files,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalSnapshot.size,
          pages: Math.ceil(totalSnapshot.size / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error('Get files error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve files',
        error: error.message,
      });
    }
  }

  // Start file processing
  async processFiles(req, res) {
    try {
      const { fileIds } = req.body;
      const userId = req.user.id;
      const db = getDB();

      // Validate files belong to user
      for (const fileId of fileIds) {
        const fileDoc = await db.collection('files').doc(fileId).get();
        if (!fileDoc.exists || fileDoc.data().userId !== userId) {
          return res.status(403).json({
            success: false,
            message: `File ${fileId} not found or access denied`,
          });
        }
      }

      // Forward to AI service for processing
      const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/api/v1/documents/process`, {
        file_ids: fileIds,
        user_id: userId,
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.AI_SERVICE_API_KEY}`,
        },
      });

      // Update file status
      for (const fileId of fileIds) {
        await db.collection('files').doc(fileId).update({
          processingStatus: 'processing',
          processingStartedAt: new Date(),
        });
      }

      res.json({
        success: true,
        message: 'File processing started',
        processingId: aiResponse.data.processing_id,
        fileIds,
      });
    } catch (error) {
      logger.error('File processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start file processing',
        error: error.message,
      });
    }
  }

  // Reprocess files (for files that failed processing or need reprocessing)
  async reprocessFiles(req, res) {
    try {
      const { fileIds } = req.body;
      const userId = req.user.id;
      const db = getDB();
      const files = [];

      // Validate files belong to user and get their metadata
      for (const fileId of fileIds) {
        const fileDoc = await db.collection('files').doc(fileId).get();
        if (!fileDoc.exists || fileDoc.data().userId !== userId) {
          return res.status(403).json({
            success: false,
            message: `File ${fileId} not found or access denied`,
          });
        }
        files.push({ id: fileDoc.id, ...fileDoc.data() });
      }

      // Process files through AI services
      try {
        await this.processFilesInAI(files, userId, req);
        
        res.json({
          success: true,
          message: 'File reprocessing started',
          fileIds,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to start file reprocessing',
          error: error.message,
        });
      }
    } catch (error) {
      logger.error('File reprocessing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reprocess files',
        error: error.message,
      });
    }
  }

  // Get file processing status
  async getFileStatus(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.id;
      const db = getDB();

      const fileDoc = await db.collection('files').doc(fileId).get();
      
      if (!fileDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      const fileData = fileDoc.data();
      if (fileData.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.json({
        success: true,
        fileId,
        status: fileData.processingStatus,
        uploadedAt: fileData.uploadedAt,
        processingStartedAt: fileData.processingStartedAt,
        processingCompletedAt: fileData.processingCompletedAt,
        error: fileData.processingError,
        vectorized: fileData.vectorized || false,
        aiProcessingResult: fileData.aiProcessingResult,
      });
    } catch (error) {
      logger.error('Get file status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get file status',
        error: error.message,
      });
    }
  }

  // Delete file
  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      const userId = req.user.id;
      const db = getDB();

      const fileDoc = await db.collection('files').doc(fileId).get();
      
      if (!fileDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }

      const fileData = fileDoc.data();
      if (fileData.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Delete from Google Cloud Storage
      try {
        await bucket.file(fileData.gcsPath).delete();
        logger.info(`Deleted file from GCS: ${fileData.gcsPath}`);
      } catch (gcsError) {
        logger.warn(`Failed to delete file from GCS: ${gcsError.message}`);
      }

      // Delete from AI service (vector store)
      try {
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        await axios.delete(`${aiServiceUrl}/api/v1/documents/`, {
          data: [fileId], // Send fileId in request body as array
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.AI_SERVICE_API_KEY && {
              Authorization: `Bearer ${process.env.AI_SERVICE_API_KEY}`
            })
          },
        });
        logger.info(`Deleted file from AI service: ${fileId}`);
      } catch (aiError) {
        logger.warn(`Failed to delete from AI service: ${aiError.response?.data || aiError.message}`);
      }

      // Delete from Firestore
      await db.collection('files').doc(fileId).delete();

      // Emit delete event
      const io = req.app.get('io');
      io.to(`user_${userId}`).emit('file_deleted', {
        fileId,
        fileName: fileData.originalName,
      });

      res.json({
        success: true,
        message: 'File deleted successfully',
        fileId,
      });
    } catch (error) {
      logger.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete file',
        error: error.message,
      });
    }
  }
}

module.exports = new FileController(); 