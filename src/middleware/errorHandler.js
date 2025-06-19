/**
 * Error handling middleware for Express applications
 */

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle Prisma errors
 * @param {Error} error - Prisma error object
 * @returns {ApiError} Formatted API error
 */
const handlePrismaError = (error) => {
  switch (error.code) {
    case "P2002":
      // Unique constraint violation
      const field = error.meta?.target?.[0] || "field";
      return new ApiError(
        `A record with this ${field} already exists.`,
        409,
        "DUPLICATE_FIELD",
        { field, value: error.meta?.target }
      );

    case "P2025":
      // Record not found
      return new ApiError(
        "The requested record was not found.",
        404,
        "RECORD_NOT_FOUND"
      );

    case "P2003":
      // Foreign key constraint violation
      return new ApiError(
        "Cannot perform this operation due to related data constraints.",
        400,
        "FOREIGN_KEY_CONSTRAINT"
      );

    case "P2014":
      // Required relation violation
      return new ApiError(
        "The operation violates a required relation.",
        400,
        "REQUIRED_RELATION_VIOLATION"
      );

    case "P2021":
      // Table does not exist
      return new ApiError(
        "Database configuration error.",
        500,
        "DATABASE_ERROR"
      );

    case "P2022":
      // Column does not exist
      return new ApiError("Database schema error.", 500, "SCHEMA_ERROR");

    default:
      console.error("Unhandled Prisma error:", error);
      return new ApiError(
        "A database error occurred.",
        500,
        "DATABASE_ERROR",
        process.env.NODE_ENV === "development" ? error.message : null
      );
  }
};

/**
 * Handle JWT errors
 * @param {Error} error - JWT error object
 * @returns {ApiError} Formatted API error
 */
const handleJWTError = (error) => {
  if (error.name === "JsonWebTokenError") {
    return new ApiError("Invalid authentication token.", 401, "INVALID_TOKEN");
  }

  if (error.name === "TokenExpiredError") {
    return new ApiError(
      "Authentication token has expired.",
      401,
      "TOKEN_EXPIRED"
    );
  }

  if (error.name === "NotBeforeError") {
    return new ApiError(
      "Authentication token is not active yet.",
      401,
      "TOKEN_NOT_ACTIVE"
    );
  }

  return new ApiError("Authentication error.", 401, "AUTH_ERROR");
};

/**
 * Handle validation errors
 * @param {Error} error - Validation error object
 * @returns {ApiError} Formatted API error
 */
const handleValidationError = (error) => {
  return new ApiError(
    "Validation failed.",
    400,
    "VALIDATION_ERROR",
    error.details || error.message
  );
};

/**
 * Handle multer (file upload) errors
 * @param {Error} error - Multer error object
 * @returns {ApiError} Formatted API error
 */
const handleMulterError = (error) => {
  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      return new ApiError("File size is too large.", 400, "FILE_TOO_LARGE");

    case "LIMIT_FILE_COUNT":
      return new ApiError("Too many files uploaded.", 400, "TOO_MANY_FILES");

    case "LIMIT_UNEXPECTED_FILE":
      return new ApiError("Unexpected file field.", 400, "UNEXPECTED_FILE");

    case "LIMIT_PART_COUNT":
      return new ApiError(
        "Too many parts in the request.",
        400,
        "TOO_MANY_PARTS"
      );

    default:
      return new ApiError("File upload error.", 400, "UPLOAD_ERROR");
  }
};

/**
 * 404 Not Found middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFound = (req, res, next) => {
  const error = new ApiError(
    `Route ${req.originalUrl} not found.`,
    404,
    "ROUTE_NOT_FOUND"
  );
  next(error);
};

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error details
  console.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });

  // Handle specific error types
  if (err.name === "PrismaClientKnownRequestError") {
    error = handlePrismaError(err);
  } else if (err.name === "PrismaClientValidationError") {
    error = new ApiError("Invalid request data.", 400, "INVALID_DATA");
  } else if (err.name === "PrismaClientUnknownRequestError") {
    error = new ApiError(
      "Database connection error.",
      500,
      "DATABASE_CONNECTION_ERROR"
    );
  } else if (
    ["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(
      err.name
    )
  ) {
    error = handleJWTError(err);
  } else if (err.name === "ValidationError" || err.type === "validation") {
    error = handleValidationError(err);
  } else if (err.name === "MulterError") {
    error = handleMulterError(err);
  } else if (
    err.name === "SyntaxError" &&
    err.status === 400 &&
    "body" in err
  ) {
    error = new ApiError("Invalid JSON in request body.", 400, "INVALID_JSON");
  } else if (err.code === "ENOENT") {
    error = new ApiError("File not found.", 404, "FILE_NOT_FOUND");
  } else if (err.code === "EACCES") {
    error = new ApiError("Permission denied.", 403, "PERMISSION_DENIED");
  } else if (!(error instanceof ApiError)) {
    // Handle unknown errors
    error = new ApiError(
      process.env.NODE_ENV === "production"
        ? "Something went wrong!"
        : err.message,
      err.statusCode || 500,
      "INTERNAL_ERROR",
      process.env.NODE_ENV === "development" ? err.stack : null
    );
  }

  // Prepare error response
  const response = {
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  // Add details in development mode
  if (process.env.NODE_ENV === "development") {
    response.details = error.details;
    response.stack = error.stack;
  }

  // Add error details if available
  if (error.details) {
    response.details = error.details;
  }

  // Set status code and send response
  res.status(error.statusCode).json(response);
};

/**
 * Express async handler wrapper
 * Usage: router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
const wrap = (fn) => asyncHandler(fn);

module.exports = {
  ApiError,
  asyncHandler,
  wrap,
  handlePrismaError,
  handleJWTError,
  handleValidationError,
  handleMulterError,
  notFound,
  errorHandler,
};
