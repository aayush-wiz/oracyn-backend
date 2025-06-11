const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  // Default error response
  let error = {
    message: err.message || "Internal Server Error",
    status: err.status || 500,
  };

  // Handle specific error types
  if (err.name === "ValidationError") {
    error = {
      message: "Validation Error",
      status: 400,
      details: err.details || err.message,
    };
  }

  if (err.name === "UnauthorizedError" || err.message.includes("jwt")) {
    error = {
      message: "Unauthorized",
      status: 401,
    };
  }

  if (err.code === "P2002") {
    // Prisma unique constraint error
    error = {
      message: "A record with this information already exists",
      status: 409,
    };
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    error = {
      message: "File too large",
      status: 413,
    };
  }

  // Send error response
  res.status(error.status).json({
    error: error.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    ...(error.details && { details: error.details }),
  });
};

export default errorHandler;
