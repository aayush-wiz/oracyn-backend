import { Router } from "express";
const router = Router();
import authMiddleware from "../middleware/authMiddleware.js";
import userController from "../controllers/userController.js";

router.get("/profile", authMiddleware, userController.getProfile);
router.put("/profile", authMiddleware, userController.updateProfile);

export default router;
