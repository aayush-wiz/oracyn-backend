// backend/src/routes/chatRoutes.js (UPDATED for Zod validation)
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import chatController from "../controllers/chatController.js";
import {
  validateCreateChat,
  validateUpdateChat,
  validateChatParams,
  validateSendMessage,
  validateSubmitQuery,
} from "../middleware/validation.js";

const router = Router();

// Get all chats for user
router.get("/", authMiddleware, chatController.getChats);

// Create new chat
router.post("/", authMiddleware, validateCreateChat, chatController.createChat);

// Get specific chat
router.get(
  "/:id",
  authMiddleware,
  validateChatParams,
  chatController.getChatMessages
);

// Update chat
router.put(
  "/:id",
  authMiddleware,
  validateUpdateChat,
  chatController.updateChat
);

// Delete chat
router.delete(
  "/:id",
  authMiddleware,
  validateChatParams,
  chatController.deleteChat
);

// Get chat files
router.get(
  "/:id/files",
  authMiddleware,
  validateChatParams,
  chatController.getChatFiles
);

// Send message
router.post(
  "/:id/messages",
  authMiddleware,
  validateSendMessage,
  chatController.sendMessage
);

// Submit query (RAG)
router.post(
  "/:id/query",
  authMiddleware,
  validateSubmitQuery,
  chatController.submitQuery
);

// Share chat
router.post(
  "/:id/share",
  authMiddleware,
  validateChatParams,
  chatController.shareChat
);

export default router;
