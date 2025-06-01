const { validationResult } = require("express-validator");
const { getDB } = require("../config/firebase");
const logger = require("../utils/logger");

class AnalysisController {
  async saveAnalysis(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { title, description, type, data, tags = [] } = req.body;
      const userId = req.user.id;
      const db = getDB();

      const analysisData = {
        userId,
        title,
        description: description || "",
        type,
        data,
        tags,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: false,
      };

      const analysisRef = await db.collection("analyses").add(analysisData);

      logger.info(`Analysis saved by user ${userId}: ${title}`);

      res.status(201).json({
        success: true,
        message: "Analysis saved successfully",
        analysisId: analysisRef.id,
        analysis: {
          id: analysisRef.id,
          ...analysisData,
        },
      });
    } catch (error) {
      logger.error("Save analysis error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save analysis",
        error: error.message,
      });
    }
  }

  async getAnalyses(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, type = "all", search } = req.query;
      const db = getDB();

      let query = db
        .collection("analyses")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc");

      if (type && type !== "all") {
        query = query.where("type", "==", type);
      }

      const analysesSnapshot = await query
        .limit(parseInt(limit))
        .offset((parseInt(page) - 1) * parseInt(limit))
        .get();

      let analyses = [];
      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        analyses.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          type: data.type,
          tags: data.tags || [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          preview: data.data ? JSON.stringify(data.data).substring(0, 200) : "",
        });
      });

      if (search) {
        const searchTerm = search.toLowerCase();
        analyses = analyses.filter(
          (analysis) =>
            analysis.title.toLowerCase().includes(searchTerm) ||
            analysis.description.toLowerCase().includes(searchTerm) ||
            analysis.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
        );
      }

      const totalSnapshot = await db
        .collection("analyses")
        .where("userId", "==", userId)
        .get();

      res.json({
        success: true,
        analyses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalSnapshot.size,
          pages: Math.ceil(totalSnapshot.size / parseInt(limit)),
        },
      });
    } catch (error) {
      logger.error("Get analyses error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analyses",
        error: error.message,
      });
    }
  }

  async getAnalysisById(req, res) {
    try {
      const { analysisId } = req.params;
      const userId = req.user.id;
      const db = getDB();

      const analysisDoc = await db.collection("analyses").doc(analysisId).get();

      if (!analysisDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Analysis not found",
        });
      }

      const analysisData = analysisDoc.data();
      if (analysisData.userId !== userId && !analysisData.isPublic) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      res.json({
        success: true,
        analysis: {
          id: analysisDoc.id,
          ...analysisData,
        },
      });
    } catch (error) {
      logger.error("Get analysis error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analysis",
        error: error.message,
      });
    }
  }

  async updateAnalysis(req, res) {
    try {
      const { analysisId } = req.params;
      const userId = req.user.id;
      const { title, description, data, tags } = req.body;
      const db = getDB();

      const analysisDoc = await db.collection("analyses").doc(analysisId).get();

      if (!analysisDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Analysis not found",
        });
      }

      const analysisData = analysisDoc.data();
      if (analysisData.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const updateData = {
        updatedAt: new Date(),
      };

      if (title) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description;
      if (data) updateData.data = data;
      if (tags) updateData.tags = tags;

      await analysisDoc.ref.update(updateData);

      logger.info(`Analysis updated by user ${userId}: ${analysisId}`);

      res.json({
        success: true,
        message: "Analysis updated successfully",
        analysisId,
      });
    } catch (error) {
      logger.error("Update analysis error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update analysis",
        error: error.message,
      });
    }
  }

  async deleteAnalysis(req, res) {
    try {
      const { analysisId } = req.params;
      const userId = req.user.id;
      const db = getDB();

      const analysisDoc = await db.collection("analyses").doc(analysisId).get();

      if (!analysisDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Analysis not found",
        });
      }

      const analysisData = analysisDoc.data();
      if (analysisData.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      await analysisDoc.ref.delete();

      logger.info(`Analysis deleted by user ${userId}: ${analysisId}`);

      res.json({
        success: true,
        message: "Analysis deleted successfully",
        analysisId,
      });
    } catch (error) {
      logger.error("Delete analysis error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete analysis",
        error: error.message,
      });
    }
  }

  async exportAnalysis(req, res) {
    try {
      const { analysisId } = req.params;
      const { format = "json" } = req.query;
      const userId = req.user.id;
      const db = getDB();

      const analysisDoc = await db.collection("analyses").doc(analysisId).get();

      if (!analysisDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Analysis not found",
        });
      }

      const analysisData = analysisDoc.data();
      if (analysisData.userId !== userId && !analysisData.isPublic) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      const exportData = {
        id: analysisDoc.id,
        ...analysisData,
        exportedAt: new Date().toISOString(),
      };

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="analysis-${analysisId}.json"`
        );
        res.send(JSON.stringify(exportData, null, 2));
      } else if (format === "csv") {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="analysis-${analysisId}.csv"`
        );

        const csvData = [
          "Title,Type,Description,Created At",
          `"${analysisData.title}","${analysisData.type}","${analysisData.description}","${analysisData.createdAt}"`,
        ].join("\n");

        res.send(csvData);
      } else {
        return res.status(400).json({
          success: false,
          message: "Unsupported export format",
        });
      }

      logger.info(
        `Analysis exported by user ${userId}: ${analysisId} (${format})`
      );
    } catch (error) {
      logger.error("Export analysis error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export analysis",
        error: error.message,
      });
    }
  }

  async exportAllAnalyses(req, res) {
    try {
      const userId = req.user.id;
      const { format = "json" } = req.query;
      const db = getDB();

      const analysesSnapshot = await db
        .collection("analyses")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();

      const analyses = [];
      analysesSnapshot.forEach((doc) => {
        analyses.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      const exportData = {
        analyses,
        exportedAt: new Date().toISOString(),
        totalCount: analyses.length,
      };

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="all-analyses-${Date.now()}.json"`
        );
        res.send(JSON.stringify(exportData, null, 2));
      } else {
        return res.status(400).json({
          success: false,
          message: "Unsupported export format for bulk export",
        });
      }

      logger.info(`All analyses exported by user ${userId} (${format})`);
    } catch (error) {
      logger.error("Export all analyses error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to export analyses",
        error: error.message,
      });
    }
  }

  async getAnalysisStats(req, res) {
    try {
      const userId = req.user.id;
      const db = getDB();

      const analysesSnapshot = await db
        .collection("analyses")
        .where("userId", "==", userId)
        .get();

      const typeCount = {};
      let totalAnalyses = 0;

      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        totalAnalyses++;
        typeCount[data.type] = (typeCount[data.type] || 0) + 1;
      });

      res.json({
        success: true,
        stats: {
          totalAnalyses,
          typeBreakdown: typeCount,
        },
      });
    } catch (error) {
      logger.error("Get analysis stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analysis statistics",
        error: error.message,
      });
    }
  }
}

module.exports = new AnalysisController();
