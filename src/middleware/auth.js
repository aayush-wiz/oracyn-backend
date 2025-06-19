const { PrismaClient } = require("@prisma/client");
const { verifyAccessToken, extractToken } = require("../utils/jwt");

const prisma = new PrismaClient();

/**
 * Authentication middleware - verifies JWT token and attaches user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header or cookies
    let token = extractToken(req.headers.authorization);

    // Fallback to cookie if no Authorization header
    if (!token && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
        code: "NO_TOKEN",
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Access denied. Invalid token.",
        code: "INVALID_TOKEN",
      });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        profession: true,
        avatar: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Access denied. User not found.",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Access denied. Account is deactivated.",
        code: "ACCOUNT_DEACTIVATED",
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during authentication.",
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header or cookies
    let token = extractToken(req.headers.authorization);

    if (!token && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // If no token, continue without authentication
    if (!token) {
      return next();
    }

    // Try to verify the token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      // If token is invalid, continue without authentication
      return next();
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        bio: true,
        profession: true,
        avatar: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If user exists and is active, attach to request
    if (user && user.isActive) {
      req.user = user;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    console.error("Optional authentication error:", error);
    // Don't fail the request, just continue without auth
    next();
  }
};

/**
 * Middleware to require email verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required.",
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      error:
        "Email verification required. Please verify your email to access this resource.",
      code: "EMAIL_VERIFICATION_REQUIRED",
    });
  }

  next();
};

/**
 * Role-based authorization middleware
 * @param {string|Array} roles - Required role(s)
 * @returns {Function} Express middleware function
 */
const authorize = (roles = []) => {
  // If roles is a string, convert to array
  if (typeof roles === "string") {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    // For now, we don't have roles in our schema
    // This can be extended later when role system is implemented
    if (roles.length > 0) {
      // Placeholder for role checking
      // const userRoles = req.user.roles || [];
      // const hasRole = roles.some(role => userRoles.includes(role));
      // if (!hasRole) {
      //   return res.status(403).json({
      //     success: false,
      //     error: 'Insufficient permissions.',
      //     code: 'INSUFFICIENT_PERMISSIONS'
      //   });
      // }
    }

    next();
  };
};

/**
 * Middleware to check if user owns the resource
 * @param {string} resourceModel - Prisma model name
 * @param {string} paramName - Parameter name to get resource ID
 * @param {string} userField - Field name that contains user ID (default: 'userId')
 * @returns {Function} Express middleware function
 */
const checkOwnership = (
  resourceModel,
  paramName = "id",
  userField = "userId"
) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required.",
          code: "AUTHENTICATION_REQUIRED",
        });
      }

      const resourceId = req.params[paramName];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          error: `${paramName} parameter is required.`,
        });
      }

      // Check if resource exists and belongs to user
      const resource = await prisma[resourceModel].findUnique({
        where: { id: resourceId },
        select: { [userField]: true },
      });

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: "Resource not found.",
          code: "RESOURCE_NOT_FOUND",
        });
      }

      if (resource[userField] !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: "Access denied. You do not own this resource.",
          code: "OWNERSHIP_REQUIRED",
        });
      }

      // Attach resource to request for further use
      req.resource = resource;

      next();
    } catch (error) {
      console.error("Ownership check error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error during ownership check.",
      });
    }
  };
};

/**
 * Rate limiting middleware for authenticated users
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
const authenticatedRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each user to 100 requests per windowMs
  } = options;

  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    let userRequestHistory = userRequests.get(userId) || [];

    // Remove old requests outside the window
    userRequestHistory = userRequestHistory.filter(
      (timestamp) => timestamp > windowStart
    );

    // Check if user has exceeded the limit
    if (userRequestHistory.length >= max) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((userRequestHistory[0] + windowMs - now) / 1000),
      });
    }

    // Add current request to history
    userRequestHistory.push(now);
    userRequests.set(userId, userRequestHistory);

    // Set rate limit headers
    res.set({
      "X-RateLimit-Limit": max,
      "X-RateLimit-Remaining": max - userRequestHistory.length,
      "X-RateLimit-Reset": new Date(now + windowMs).toISOString(),
    });

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireVerification,
  authorize,
  checkOwnership,
  authenticatedRateLimit,
};
