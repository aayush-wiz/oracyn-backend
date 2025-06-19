const { z } = require("zod");

// Custom password validation
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be less than 128 characters long")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    "Password must contain at least one special character"
  );

// User registration schema
const registerSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .email("Please provide a valid email address")
        .max(255, "Email must be less than 255 characters")
        .toLowerCase(),
      username: z
        .string()
        .min(3, "Username must be at least 3 characters long")
        .max(30, "Username must be less than 30 characters")
        .regex(
          /^[a-zA-Z0-9_-]+$/,
          "Username can only contain letters, numbers, underscores, and hyphens"
        )
        .toLowerCase(),
      password: passwordSchema,
      confirmPassword: z.string(),
      firstName: z
        .string()
        .min(1, "First name is required")
        .max(50, "First name must be less than 50 characters")
        .regex(
          /^[a-zA-Z\s'-]+$/,
          "First name can only contain letters, spaces, hyphens, and apostrophes"
        )
        .optional(),
      lastName: z
        .string()
        .min(1, "Last name is required")
        .max(50, "Last name must be less than 50 characters")
        .regex(
          /^[a-zA-Z\s'-]+$/,
          "Last name can only contain letters, spaces, hyphens, and apostrophes"
        )
        .optional(),
      profession: z
        .string()
        .max(100, "Profession must be less than 100 characters")
        .optional(),
      bio: z
        .string()
        .max(500, "Bio must be less than 500 characters")
        .optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }),
});

// User login schema
const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase(),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().optional().default(false),
  }),
});

// Update profile schema
const updateProfileSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, "First name is required")
      .max(50, "First name must be less than 50 characters")
      .regex(
        /^[a-zA-Z\s'-]+$/,
        "First name can only contain letters, spaces, hyphens, and apostrophes"
      )
      .optional(),
    lastName: z
      .string()
      .min(1, "Last name is required")
      .max(50, "Last name must be less than 50 characters")
      .regex(
        /^[a-zA-Z\s'-]+$/,
        "Last name can only contain letters, spaces, hyphens, and apostrophes"
      )
      .optional(),
    profession: z
      .string()
      .max(100, "Profession must be less than 100 characters")
      .optional(),
    bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  }),
});

// Change password schema
const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: passwordSchema,
      confirmNewPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
      message: "New passwords don't match",
      path: ["confirmNewPassword"],
    }),
});

// Forgot password schema
const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase(),
  }),
});

// Reset password schema
const resetPasswordSchema = z.object({
  body: z
    .object({
      token: z.string().min(1, "Reset token is required"),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }),
});

// Verify email schema
const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Verification token is required"),
  }),
});

// Resend verification schema
const resendVerificationSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase(),
  }),
});

// Chat creation schema
const createChatSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(1, "Chat title is required")
      .max(100, "Chat title must be less than 100 characters")
      .optional(),
  }),
});

// Message creation schema
const createMessageSchema = z.object({
  body: z.object({
    content: z
      .string()
      .min(1, "Message content is required")
      .max(10000, "Message content must be less than 10000 characters"),
    role: z.enum(["user", "assistant", "system"]).default("user"),
  }),
});

// ID parameter validation
const idParamSchema = z.object({
  params: z.object({
    id: z
      .string()
      .min(1, "ID is required")
      .regex(/^[a-zA-Z0-9_-]+$/, "Invalid ID format"),
  }),
});

// Query pagination schema
const paginationSchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, "Page must be a positive number")
      .transform(Number)
      .refine((val) => val > 0, "Page must be greater than 0")
      .optional()
      .default("1"),
    limit: z
      .string()
      .regex(/^\d+$/, "Limit must be a positive number")
      .transform(Number)
      .refine((val) => val > 0 && val <= 100, "Limit must be between 1 and 100")
      .optional()
      .default("10"),
    sortBy: z.string().optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

/**
 * Validation middleware factory
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Validate the request data
      const validatedData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace request data with validated and transformed data
      req.body = validatedData.body || req.body;
      req.query = validatedData.query || req.query;
      req.params = validatedData.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          value: err.input,
        }));

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors,
        });
      }

      // Handle unexpected validation errors
      console.error("Unexpected validation error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal validation error",
      });
    }
  };
};

/**
 * Custom validation for file uploads
 * @param {Object} options - Upload validation options
 * @returns {Function} Express middleware function
 */
const validateFileUpload = (options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ["image/jpeg", "image/png", "application/pdf", "text/plain"],
    required = false,
  } = options;

  return (req, res, next) => {
    if (!req.file && required) {
      return res.status(400).json({
        success: false,
        error: "File is required",
      });
    }

    if (!req.file) {
      return next();
    }

    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: `File size must be less than ${Math.round(
          maxSize / 1024 / 1024
        )}MB`,
      });
    }

    // Check file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `File type not allowed. Allowed types: ${allowedTypes.join(
          ", "
        )}`,
      });
    }

    next();
  };
};

module.exports = {
  // Schemas
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  createChatSchema,
  createMessageSchema,
  idParamSchema,
  paginationSchema,

  // Middleware
  validate,
  validateFileUpload,
};
