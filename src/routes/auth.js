const express = require("express");
const {
  register,
  login,
  logout,
  refresh,
  getMe,
  updateProfile,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const { authenticate, requireVerification } = require("../middleware/auth");
const {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../middleware/validation");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", validate(registerSchema), register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", validate(loginSchema), login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clears refresh token cookie)
 * @access  Private
 */
router.post("/logout", authenticate, logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires refresh token)
 */
router.post("/refresh", refresh);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authenticate, getMe);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  authenticate,
  validate(updateProfileSchema),
  updateProfile
);

/**
 * @route   PUT /api/auth/password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  "/password",
  authenticate,
  validate(changePasswordSchema),
  changePassword
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email with token
 * @access  Public
 */
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification token
 * @access  Public
 */
router.post(
  "/resend-verification",
  validate(resendVerificationSchema),
  resendVerification
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset token to email
 * @access  Public
 */
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// Protected routes that require email verification
router.use(requireVerification);

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account (soft delete)
 * @access  Private (verified users only)
 */
router.delete("/account", authenticate, async (req, res, next) => {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    // Soft delete - deactivate account instead of actually deleting
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isActive: false,
        email: `deleted_${Date.now()}_${req.user.email}`, // Prefix to allow email reuse
        username: `deleted_${Date.now()}_${req.user.username}`, // Prefix to allow username reuse
        updatedAt: new Date(),
      },
    });

    // Clear refresh token cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({
      success: true,
      message: "Account deactivated successfully.",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
