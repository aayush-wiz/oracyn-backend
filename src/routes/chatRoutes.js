import { Router } from "express";
const router = Router();
import authMiddleware from "../middleware/authMiddleware.js";
import chatController from "../controllers/chatController.js";

router.get("/", authMiddleware, chatController.getChats);
router.post("/", authMiddleware, chatController.createChat);
router.patch("/:id", authMiddleware, chatController.updateChat);
router.delete("/:id", authMiddleware, chatController.deleteChat);
router.get("/:id/files", authMiddleware, chatController.getChatFiles);
router.post("/:id/query", authMiddleware, chatController.submitQuery);
router.post("/:id/share", authMiddleware, chatController.shareChat);

//routes for chat functionality
router.get("/:id/messages", authMiddleware, chatController.getChatMessages);
router.post("/:id/messages", authMiddleware, chatController.sendMessage);

export default router;
