const jwt = require("jsonwebtoken");
const { getAuth } = require("../config/firebase");
const logger = require("../utils/logger");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Optionally verify with Firebase Auth for additional security
      if (decoded.firebaseUid) {
        const auth = getAuth();
        const userRecord = await auth.getUser(decoded.firebaseUid);

        if (!userRecord) {
          return res.status(401).json({
            success: false,
            message: "Invalid user",
          });
        }
      }

      // Add user info to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        firebaseUid: decoded.firebaseUid,
        role: decoded.role || "user",
      };

      next();
    } catch (jwtError) {
      logger.warn("JWT verification failed:", jwtError.message);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
  } catch (error) {
    logger.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

// Optional middleware for admin-only routes
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
};
