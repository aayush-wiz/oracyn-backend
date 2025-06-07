import { Router } from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import { uploadFile } from "../controllers/uploadController.js";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/chats/:id/upload", authMiddleware, upload.single("file"), uploadFile);

export default router;