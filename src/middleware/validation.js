// middleware/validation.js
import { z } from "zod";

// Generic validation middleware
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const result = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      // Replace request data with validated data
      req.body = result.body || req.body;
      req.params = result.params || req.params;
      req.query = result.query || req.query;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
            code: err.code,
          })),
        });
      }
      next(error);
    }
  };
};

// Auth validation schemas
export const signupSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name must be less than 50 characters")
      .trim(),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name must be less than 50 characters")
      .trim(),
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must be less than 100 characters"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .toLowerCase()
      .trim(),
    password: z.string().min(1, "Password is required"),
  }),
});

// Chat validation schemas
export const createChatSchema = z.object({
  body: z.object({
    title: z
      .string()
      .max(255, "Title must be less than 255 characters")
      .trim()
      .optional(),
  }),
});

export const updateChatSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, "Invalid chat ID"),
  }),
  body: z.object({
    title: z
      .string()
      .max(255, "Title must be less than 255 characters")
      .trim()
      .optional(),
    status: z.enum(["STARRED", "SAVED", "NONE"]).optional(),
    state: z.enum(["UPLOAD", "CHAT", "VISUALIZE"]).optional(),
  }),
});

export const chatParamsSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, "Invalid chat ID"),
  }),
});

// Message validation schemas
export const sendMessageSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, "Invalid chat ID"),
  }),
  body: z.object({
    content: z
      .string()
      .min(1, "Message content is required")
      .max(10000, "Message content is too long")
      .trim(),
    type: z.enum(["REGULAR", "QUERY", "RESPONSE", "SYSTEM"]).default("REGULAR"),
  }),
});

export const submitQuerySchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, "Invalid chat ID"),
  }),
  body: z.object({
    prompt: z
      .string()
      .min(1, "Query prompt is required")
      .max(5000, "Query prompt is too long")
      .trim(),
  }),
});

// User validation schemas
export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(2, "First name must be at least 2 characters")
      .max(50, "First name must be less than 50 characters")
      .trim()
      .optional(),
    lastName: z
      .string()
      .min(2, "Last name must be at least 2 characters")
      .max(50, "Last name must be less than 50 characters")
      .trim()
      .optional(),
  }),
});

// File validation schema
export const fileUploadSchema = z.object({
  params: z.object({
    id: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, "Invalid chat ID"),
  }),
});

// Export convenience validators
export const validateSignup = validate(signupSchema);
export const validateLogin = validate(loginSchema);
export const validateCreateChat = validate(createChatSchema);
export const validateUpdateChat = validate(updateChatSchema);
export const validateChatParams = validate(chatParamsSchema);
export const validateSendMessage = validate(sendMessageSchema);
export const validateSubmitQuery = validate(submitQuerySchema);
export const validateUpdateProfile = validate(updateProfileSchema);
export const validateFileUpload = validate(fileUploadSchema);
