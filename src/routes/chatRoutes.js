import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import chatController from "../controllers/chatController.js";
import { queryLimiter } from "../middleware/rateLimiter.js";
import {
  validateCreateChat,
  validateUpdateChat,
  validateChatParams,
  validateSendMessage,
  validateSubmitQuery,
} from "../middleware/validation.js";

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Chat CRUD operations
router.get("/", chatController.getChats);
router.post("/", validateCreateChat, chatController.createChat);
router.patch("/:id", validateUpdateChat, chatController.updateChat);
router.delete("/:id", validateChatParams, chatController.deleteChat);

// Chat file operations
router.get("/:id/files", validateChatParams, chatController.getChatFiles);

// Chat message operations
router.get("/:id/messages", validateChatParams, chatController.getChatMessages);
router.post("/:id/messages", validateSendMessage, chatController.sendMessage);

// Query operations with rate limiting
router.post(
  "/:id/query",
  queryLimiter,
  validateSubmitQuery,
  chatController.submitQuery
);

// Share operations
router.post("/:id/share", validateChatParams, chatController.shareChat);

export default router;
