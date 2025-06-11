import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import userController from "../controllers/userController.js";
import { validateUpdateProfile } from "../middleware/validation.js";

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// User profile operations
router.get("/profile", userController.getProfile);
router.put("/profile", validateUpdateProfile, userController.updateProfile);

export default router;
