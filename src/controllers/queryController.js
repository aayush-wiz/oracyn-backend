const { validationResult } = require("express-validator");
const { getDB } = require("../config/firebase");
const logger = require("../utils/logger");
const axios = require("axios");

class QueryController {
  // Submit a query to the RAG system
  async submitQuery(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { query, fileIds = [], top_k } = req.body;
      const userId = req.user.id;
      const db = getDB();

      // Validate file access if fileIds provided
      if (fileIds.length > 0) {
        for (const fileId of fileIds) {
          const fileDoc = await db.collection("files").doc(fileId).get();
          if (!fileDoc.exists || fileDoc.data().userId !== userId) {
            return res.status(403).json({
              success: false,
              message: `File ${fileId} not found or access denied`,
            });
          }
        }
      }

      // Store query in Firestore
      const queryData = {
        userId,
        query,
        fileIds,
        status: "processing",
        createdAt: new Date(),
      };

      const queryRef = await db.collection("queries").add(queryData);

      // Emit socket event for real-time updates
      const io = req.app.get("io");
      io.to(`user_${userId}`).emit("query_processing_started", {
        queryId: queryRef.id,
        query,
        status: "processing",
      });

      try {
        // Updated AI service endpoint and payload structure
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const aiPayload = {
          query: query,
          top_k: top_k || 5,
          filters: fileIds.length > 0 ? { file_ids: fileIds } : null
        };

        logger.info(`Sending query to AI service: ${aiServiceUrl}/api/v1/query/`, aiPayload);

        const aiResponse = await axios.post(
          `${aiServiceUrl}/api/v1/query/`,
          aiPayload,
          {
            headers: {
              "Content-Type": "application/json",
              ...(process.env.AI_SERVICE_API_KEY && {
                Authorization: `Bearer ${process.env.AI_SERVICE_API_KEY}`
              })
            },
            timeout: 60000, // 60 seconds timeout for processing
          }
        );

        // Extract response data with updated structure
        const responseData = aiResponse.data;
        const aiResponseText = responseData.response;
        const sources = responseData.sources || [];

        // Update query with AI response
        await queryRef.update({
          status: "completed",
          response: aiResponseText,
          sourceNodes: sources,
          completedAt: new Date(),
          processingTime: Date.now() - queryData.createdAt.getTime(),
        });

        // Emit completion event
        io.to(`user_${userId}`).emit("query_result", {
          queryId: queryRef.id,
          query,
          response: aiResponseText,
          sourceNodes: sources,
          status: "completed",
        });

        logger.info(`Query processed successfully for user ${userId}`);

        res.json({
          success: true,
          queryId: queryRef.id,
          response: aiResponseText,
          sourceNodes: sources,
          processingTime: Date.now() - queryData.createdAt.getTime(),
        });
      } catch (aiError) {
        logger.error("AI service error:", aiError.response?.data || aiError.message);

        // Update query with error
        await queryRef.update({
          status: "failed",
          error: aiError.response?.data?.detail || aiError.message,
          completedAt: new Date(),
        });

        // Emit error event
        io.to(`user_${userId}`).emit("query_error", {
          queryId: queryRef.id,
          query,
          error: aiError.response?.data?.detail || aiError.message,
          status: "failed",
        });

        return res.status(500).json({
          success: false,
          message: "Failed to process query",
          error: aiError.response?.data?.detail || "AI service unavailable",
          queryId: queryRef.id,
        });
      }
    } catch (error) {
      logger.error("Query submission error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit query",
        error: error.message,
      });
    }
  }

  // Get query history
  async getQueryHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;
      const db = getDB();

      let query = db
        .collection("queries")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc");

      // Filter by status if provided
      if (status) {
        query = query.where("status", "==", status);
      }

      const queriesSnapshot = await query
        .limit(parseInt(limit))
        .offset((parseInt(page) - 1) * parseInt(limit))
        .get();

      const queries = [];
      queriesSnapshot.forEach((doc) => {
        const data = doc.data();
        queries.push({
          id: doc.id,
          query: data.query,
          response: data.response,
          status: data.status,
          fileIds: data.fileIds || [],
          createdAt: data.createdAt,
          completedAt: data.completedAt,
          processingTime: data.processingTime,
          error: data.error,
        });
      });

      // Get total count for pagination
      const totalSnapshot = await db
        .collection("queries")
        .where("userId", "==", userId)
        .get();

      res.json({
        success: true,
        queries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalSnapshot.size,
          pages: Math.ceil(totalSnapshot.size / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error("Get query history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve query history",
        error: error.message,
      });
    }
  }

  // Get specific query by ID
  async getQueryById(req, res) {
    try {
      const { queryId } = req.params;
      const userId = req.user.id;
      const db = getDB();

      const queryDoc = await db.collection("queries").doc(queryId).get();

      if (!queryDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Query not found",
        });
      }

      const queryData = queryDoc.data();
      if (queryData.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.json({
        success: true,
        query: {
          id: queryDoc.id,
          ...queryData,
        },
      });
    } catch (error) {
      logger.error("Get query error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve query",
        error: error.message,
      });
    }
  }

  // Delete query
  async deleteQuery(req, res) {
    try {
      const { queryId } = req.params;
      const userId = req.user.id;
      const db = getDB();

      const queryDoc = await db.collection("queries").doc(queryId).get();

      if (!queryDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Query not found",
        });
      }

      const queryData = queryDoc.data();
      if (queryData.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      await queryDoc.ref.delete();

      logger.info(`Query ${queryId} deleted by user ${userId}`);

      res.json({
        success: true,
        message: "Query deleted successfully",
        queryId,
      });
    } catch (error) {
      logger.error("Delete query error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete query",
        error: error.message,
      });
    }
  }

  // Clear all query history
  async clearQueryHistory(req, res) {
    try {
      const userId = req.user.id;
      const db = getDB();

      const queriesSnapshot = await db
        .collection("queries")
        .where("userId", "==", userId)
        .get();

      const batch = db.batch();
      queriesSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      logger.info(`All queries cleared for user ${userId}`);

      res.json({
        success: true,
        message: "Query history cleared successfully",
        deletedCount: queriesSnapshot.size,
      });
    } catch (error) {
      logger.error("Clear query history error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear query history",
        error: error.message,
      });
    }
  }

  // Get query statistics
  async getQueryStats(req, res) {
    try {
      const userId = req.user.id;
      const db = getDB();

      const queriesSnapshot = await db
        .collection("queries")
        .where("userId", "==", userId)
        .get();

      let totalQueries = 0;
      let completedQueries = 0;
      let failedQueries = 0;
      let totalProcessingTime = 0;

      queriesSnapshot.forEach((doc) => {
        const data = doc.data();
        totalQueries++;

        if (data.status === "completed") {
          completedQueries++;
          if (data.processingTime) {
            totalProcessingTime += data.processingTime;
          }
        } else if (data.status === "failed") {
          failedQueries++;
        }
      });

      const avgProcessingTime =
        completedQueries > 0 ? totalProcessingTime / completedQueries : 0;

      res.json({
        success: true,
        stats: {
          totalQueries,
          completedQueries,
          failedQueries,
          pendingQueries: totalQueries - completedQueries - failedQueries,
          avgProcessingTime: Math.round(avgProcessingTime),
          successRate:
            totalQueries > 0
              ? ((completedQueries / totalQueries) * 100).toFixed(1)
              : 0,
        },
      });
    } catch (error) {
      logger.error("Get query stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve query statistics",
        error: error.message,
      });
    }
  }
}

module.exports = new QueryController();
