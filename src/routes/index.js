const express = require("express");

// Import route modules
const authRoutes = require("./auth");
// const chatRoutes = require('./chats');
// const documentRoutes = require('./documents');
// const chartRoutes = require('./charts');
// const userRoutes = require('./users');

const router = express.Router();

/**
 * API Status endpoint
 * @route GET /api/status
 * @desc Get API status and information
 * @access Public
 */
router.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Oracyn API is running!",
    data: {
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      features: {
        authentication: true,
        fileUpload: true,
        charts: false, // Will be enabled when LLM backend is connected
        documents: false, // Will be enabled when LLM backend is connected
        emailVerification: true,
        passwordReset: true,
      },
    },
  });
});

/**
 * API Health Check endpoint (more detailed than /health)
 * @route GET /api/health
 * @desc Detailed health check including database connection
 * @access Public
 */
router.get("/health", async (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    services: {},
  };

  try {
    // Check database connection
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = {
      status: "UP",
      responseTime: "OK",
    };

    await prisma.$disconnect();
  } catch (error) {
    healthCheck.status = "DEGRADED";
    healthCheck.services.database = {
      status: "DOWN",
      error: error.message,
    };
  }

  // Check Redis connection (if implemented)
  try {
    // TODO: Add Redis health check when implemented
    healthCheck.services.redis = {
      status: "NOT_IMPLEMENTED",
    };
  } catch (error) {
    healthCheck.services.redis = {
      status: "DOWN",
      error: error.message,
    };
  }

  // Overall status
  const serviceStatuses = Object.values(healthCheck.services).map(
    (service) => service.status
  );
  if (serviceStatuses.includes("DOWN")) {
    healthCheck.status = "DOWN";
  } else if (serviceStatuses.includes("DEGRADED")) {
    healthCheck.status = "DEGRADED";
  }

  const statusCode = healthCheck.status === "OK" ? 200 : 503;
  res.status(statusCode).json({
    success: healthCheck.status !== "DOWN",
    data: healthCheck,
  });
});

// Mount route modules
router.use("/auth", authRoutes);

// Placeholder routes for future implementation
router.use("/chats", (req, res) => {
  res.status(501).json({
    success: false,
    error: "Chat routes not implemented yet. Will be connected to LLM backend.",
    code: "NOT_IMPLEMENTED",
  });
});

router.use("/documents", (req, res) => {
  res.status(501).json({
    success: false,
    error:
      "Document routes not implemented yet. Will be connected to LLM backend.",
    code: "NOT_IMPLEMENTED",
  });
});

router.use("/charts", (req, res) => {
  res.status(501).json({
    success: false,
    error:
      "Chart routes not implemented yet. Will be connected to LLM backend.",
    code: "NOT_IMPLEMENTED",
  });
});

// API documentation placeholder
router.get("/docs", (req, res) => {
  res.json({
    success: true,
    message: "API Documentation",
    data: {
      version: "1.0.0",
      baseUrl: `${req.protocol}://${req.get("host")}/api`,
      authentication: {
        type: "Bearer Token (JWT)",
        endpoints: {
          register: "POST /auth/register",
          login: "POST /auth/login",
          logout: "POST /auth/logout",
          refresh: "POST /auth/refresh",
          profile: "GET /auth/me",
          updateProfile: "PUT /auth/profile",
          changePassword: "PUT /auth/password",
          verifyEmail: "POST /auth/verify-email",
          resendVerification: "POST /auth/resend-verification",
          forgotPassword: "POST /auth/forgot-password",
          resetPassword: "POST /auth/reset-password",
          deleteAccount: "DELETE /auth/account",
        },
      },
      features: {
        implemented: [
          "User Registration & Login",
          "JWT Authentication with Refresh Tokens",
          "Email Verification",
          "Password Reset",
          "Profile Management",
          "Account Deactivation",
        ],
        planned: [
          "Chat Management (LLM Backend)",
          "Document Upload & Processing (LLM Backend)",
          "Chart Generation (LLM Backend)",
          "File Management",
          "Advanced User Management",
        ],
      },
      support: {
        email: "support@oracyn.com",
        docs: "/api/docs",
        health: "/api/health",
        status: "/api/status",
      },
    },
  });
});

// Catch-all route for undefined API endpoints
router.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint ${req.method} ${req.originalUrl} not found.`,
    code: "ENDPOINT_NOT_FOUND",
    suggestion: "Check /api/docs for available endpoints.",
  });
});

module.exports = router;
