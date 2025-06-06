import { Router } from "express";
const router = Router();
import authMiddleware from "../middleware/authMiddleware.js";
import chatController from "../controllers/chatController.js";

router.get("/chats", authMiddleware, chatController.getChats);
router.post("/chats", authMiddleware, chatController.createChat);

export default router;
