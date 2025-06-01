const { getDB } = require("../config/firebase");
const logger = require("../utils/logger");

class AnalyticsController {
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const db = getDB();

      // Get file statistics
      const filesSnapshot = await db
        .collection("files")
        .where("userId", "==", userId)
        .get();

      let fileStats = {
        total: 0,
        uploaded: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalSize: 0,
      };

      filesSnapshot.forEach((doc) => {
        const data = doc.data();
        fileStats.total++;
        fileStats.totalSize += data.size || 0;

        switch (data.processingStatus) {
          case "pending":
          case "uploaded":
            fileStats.uploaded++;
            break;
          case "processing":
            fileStats.processing++;
            break;
          case "completed":
            fileStats.completed++;
            break;
          case "failed":
            fileStats.failed++;
            break;
        }
      });

      // Get query statistics
      const queriesSnapshot = await db
        .collection("queries")
        .where("userId", "==", userId)
        .get();

      let queryStats = {
        total: 0,
        completed: 0,
        failed: 0,
        processing: 0,
        avgProcessingTime: 0,
      };

      let totalProcessingTime = 0;
      let completedQueries = 0;

      queriesSnapshot.forEach((doc) => {
        const data = doc.data();
        queryStats.total++;

        switch (data.status) {
          case "completed":
            queryStats.completed++;
            completedQueries++;
            if (data.processingTime) {
              totalProcessingTime += data.processingTime;
            }
            break;
          case "failed":
            queryStats.failed++;
            break;
          case "processing":
            queryStats.processing++;
            break;
        }
      });

      if (completedQueries > 0) {
        queryStats.avgProcessingTime = Math.round(
          totalProcessingTime / completedQueries
        );
      }

      // Get analysis statistics
      const analysesSnapshot = await db
        .collection("analyses")
        .where("userId", "==", userId)
        .get();

      let analysisStats = {
        total: analysesSnapshot.size,
        byType: {},
      };

      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        analysisStats.byType[data.type] =
          (analysisStats.byType[data.type] || 0) + 1;
      });

      res.json({
        success: true,
        dashboard: {
          files: fileStats,
          queries: queryStats,
          analyses: analysisStats,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Get dashboard data error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve dashboard data",
        error: error.message,
      });
    }
  }

  async getQueryAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const { timeRange = "7d" } = req.query;
      const db = getDB();

      // Calculate date range
      const now = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "24h":
          startDate.setHours(now.getHours() - 24);
          break;
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      const queriesSnapshot = await db
        .collection("queries")
        .where("userId", "==", userId)
        .where("createdAt", ">=", startDate)
        .orderBy("createdAt", "desc")
        .get();

      const dailyStats = {};
      const statusDistribution = { completed: 0, failed: 0, processing: 0 };
      const processingTimes = [];

      queriesSnapshot.forEach((doc) => {
        const data = doc.data();
        const dateKey = data.createdAt.toDate().toISOString().split("T")[0];

        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = { total: 0, completed: 0, failed: 0 };
        }
        dailyStats[dateKey].total++;

        statusDistribution[data.status] =
          (statusDistribution[data.status] || 0) + 1;

        if (data.status === "completed") {
          dailyStats[dateKey].completed++;
          if (data.processingTime) {
            processingTimes.push(data.processingTime);
          }
        } else if (data.status === "failed") {
          dailyStats[dateKey].failed++;
        }
      });

      const avgProcessingTime =
        processingTimes.length > 0
          ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
          : 0;

      const maxProcessingTime =
        processingTimes.length > 0 ? Math.max(...processingTimes) : 0;

      res.json({
        success: true,
        analytics: {
          timeRange,
          totalQueries: queriesSnapshot.size,
          dailyStats,
          statusDistribution,
          processingTimeStats: {
            average: Math.round(avgProcessingTime),
            maximum: maxProcessingTime,
            samples: processingTimes.length,
          },
        },
      });
    } catch (error) {
      logger.error("Get query analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve query analytics",
        error: error.message,
      });
    }
  }

  async getFileAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const db = getDB();

      const filesSnapshot = await db
        .collection("files")
        .where("userId", "==", userId)
        .get();

      const analytics = {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        processingStatus: {},
        uploadTrend: {},
      };

      filesSnapshot.forEach((doc) => {
        const data = doc.data();
        analytics.totalFiles++;
        analytics.totalSize += data.size || 0;

        const fileExtension =
          data.originalName?.split(".").pop()?.toLowerCase() || "unknown";
        analytics.fileTypes[fileExtension] =
          (analytics.fileTypes[fileExtension] || 0) + 1;

        const status = data.processingStatus || "unknown";
        analytics.processingStatus[status] =
          (analytics.processingStatus[status] || 0) + 1;

        if (data.uploadedAt) {
          const dateKey = data.uploadedAt.toDate().toISOString().split("T")[0];
          analytics.uploadTrend[dateKey] =
            (analytics.uploadTrend[dateKey] || 0) + 1;
        }
      });

      const formatSize = (bytes) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      };

      analytics.totalSizeFormatted = formatSize(analytics.totalSize);

      res.json({
        success: true,
        analytics,
      });
    } catch (error) {
      logger.error("Get file analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve file analytics",
        error: error.message,
      });
    }
  }

  async getUsageAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const { timeRange = "30d" } = req.query;
      const db = getDB();

      const now = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }

      const [queriesSnapshot, filesSnapshot, analysesSnapshot] =
        await Promise.all([
          db
            .collection("queries")
            .where("userId", "==", userId)
            .where("createdAt", ">=", startDate)
            .get(),
          db
            .collection("files")
            .where("userId", "==", userId)
            .where("uploadedAt", ">=", startDate)
            .get(),
          db
            .collection("analyses")
            .where("userId", "==", userId)
            .where("createdAt", ">=", startDate)
            .get(),
        ]);

      const dailyActivity = {};

      queriesSnapshot.forEach((doc) => {
        const data = doc.data();
        const dateKey = data.createdAt.toDate().toISOString().split("T")[0];
        if (!dailyActivity[dateKey]) {
          dailyActivity[dateKey] = { queries: 0, files: 0, analyses: 0 };
        }
        dailyActivity[dateKey].queries++;
      });

      filesSnapshot.forEach((doc) => {
        const data = doc.data();
        const dateKey = data.uploadedAt.toDate().toISOString().split("T")[0];
        if (!dailyActivity[dateKey]) {
          dailyActivity[dateKey] = { queries: 0, files: 0, analyses: 0 };
        }
        dailyActivity[dateKey].files++;
      });

      analysesSnapshot.forEach((doc) => {
        const data = doc.data();
        const dateKey = data.createdAt.toDate().toISOString().split("T")[0];
        if (!dailyActivity[dateKey]) {
          dailyActivity[dateKey] = { queries: 0, files: 0, analyses: 0 };
        }
        dailyActivity[dateKey].analyses++;
      });

      const totals = {
        queries: queriesSnapshot.size,
        files: filesSnapshot.size,
        analyses: analysesSnapshot.size,
      };

      res.json({
        success: true,
        usage: {
          timeRange,
          totals,
          dailyActivity,
          periodStart: startDate.toISOString(),
          periodEnd: now.toISOString(),
        },
      });
    } catch (error) {
      logger.error("Get usage analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve usage analytics",
        error: error.message,
      });
    }
  }

  async getSystemMetrics(req, res) {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const db = getDB();

      const [usersSnapshot, filesSnapshot, queriesSnapshot] = await Promise.all(
        [
          db.collection("users").get(),
          db.collection("files").get(),
          db.collection("queries").get(),
        ]
      );

      const systemMetrics = {
        users: {
          total: usersSnapshot.size,
          active: 0,
        },
        files: {
          total: filesSnapshot.size,
          totalSize: 0,
        },
        queries: {
          total: queriesSnapshot.size,
          completed: 0,
          failed: 0,
        },
      };

      filesSnapshot.forEach((doc) => {
        const data = doc.data();
        systemMetrics.files.totalSize += data.size || 0;
      });

      queriesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "completed") {
          systemMetrics.queries.completed++;
        } else if (data.status === "failed") {
          systemMetrics.queries.failed++;
        }
      });

      res.json({
        success: true,
        systemMetrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Get system metrics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve system metrics",
        error: error.message,
      });
    }
  }
}

module.exports = new AnalyticsController();
