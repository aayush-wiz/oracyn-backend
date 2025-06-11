import { Router } from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadFile } from "../controllers/uploadController.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";
import { validateFileUpload } from "../middleware/validation.js";

const router = Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Please upload PDF, Word, Excel, PowerPoint, CSV, or text files."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only one file at a time
  },
  fileFilter,
});

// File upload with rate limiting, auth, and validation
router.post(
  "/chats/:id/upload",
  authMiddleware,
  uploadLimiter,
  validateFileUpload,
  upload.single("file"),
  uploadFile
);

export default router;
