import { Router } from "express";
import authController from "../controllers/authController.js";
import { validateSignup, validateLogin } from "../middleware/validation.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

// Signup route with validation
router.post("/signup", validateSignup, authController.signup);

// Login route with validation
router.post("/login", validateLogin, authController.login);

export default router;
