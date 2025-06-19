const { PrismaClient } = require("@prisma/client");
const { hashPassword, comparePassword } = require("../utils/bcrypt");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt");
const { ApiError, asyncHandler } = require("../middleware/errorHandler");
const crypto = require("crypto");

const prisma = new PrismaClient();

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, username, password, firstName, lastName, profession, bio } =
    req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new ApiError(
        "A user with this email already exists.",
        409,
        "EMAIL_EXISTS"
      );
    }
    if (existingUser.username === username) {
      throw new ApiError(
        "A user with this username already exists.",
        409,
        "USERNAME_EXISTS"
      );
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Generate email verification token
  const emailVerificationToken = crypto.randomBytes(32).toString("hex");
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      profession,
      bio,
      emailVerificationToken,
      emailVerificationExpires,
      isVerified: false, // Require email verification
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      profession: true,
      bio: true,
      isVerified: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const tokens = generateTokens(user);

  // Set refresh token as httpOnly cookie
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully. Please verify your email.",
    data: {
      user,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    },
    meta: {
      emailVerificationRequired: true,
      verificationToken: emailVerificationToken, // In production, send this via email
    },
  });
});

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      firstName: true,
      lastName: true,
      profession: true,
      bio: true,
      avatar: true,
      isActive: true,
      isVerified: true,
      lastLogin: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(
      "Invalid email or password.",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (!user.isActive) {
    throw new ApiError(
      "Account is deactivated. Please contact support.",
      401,
      "ACCOUNT_DEACTIVATED"
    );
  }

  // Check password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(
      "Invalid email or password.",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Remove password from user object
  const { password: _, ...userWithoutPassword } = user;

  // Generate tokens
  const tokens = generateTokens(userWithoutPassword);

  // Set refresh token as httpOnly cookie
  const cookieMaxAge = rememberMe
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000; // 7 days or 1 day
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: cookieMaxAge,
  });

  res.json({
    success: true,
    message: "Login successful.",
    data: {
      user: userWithoutPassword,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    },
    meta: {
      rememberMe,
      lastLogin: user.lastLogin,
    },
  });
});

/**
 * Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
const logout = asyncHandler(async (req, res) => {
  // Clear refresh token cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.json({
    success: true,
    message: "Logout successful.",
  });
});

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 * @access Public (requires refresh token)
 */
const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw new ApiError("Refresh token not provided.", 401, "NO_REFRESH_TOKEN");
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new ApiError(
      "Invalid or expired refresh token.",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      profession: true,
      bio: true,
      avatar: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError("User not found.", 401, "USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw new ApiError("Account is deactivated.", 401, "ACCOUNT_DEACTIVATED");
  }

  // Generate new tokens
  const tokens = generateTokens(user);

  // Set new refresh token as httpOnly cookie
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    message: "Token refreshed successfully.",
    data: {
      user,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    },
  });
});

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
const getMe = asyncHandler(async (req, res) => {
  // User is already attached to request by auth middleware
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      profession: true,
      bio: true,
      avatar: true,
      isActive: true,
      isVerified: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          chats: true,
          documents: true,
          charts: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError("User not found.", 404, "USER_NOT_FOUND");
  }

  res.json({
    success: true,
    data: { user },
  });
});

/**
 * Update user profile
 * @route PUT /api/auth/profile
 * @access Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, profession, bio } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      firstName,
      lastName,
      profession,
      bio,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      profession: true,
      bio: true,
      avatar: true,
      isVerified: true,
      updatedAt: true,
    },
  });

  res.json({
    success: true,
    message: "Profile updated successfully.",
    data: { user: updatedUser },
  });
});

/**
 * Change password
 * @route PUT /api/auth/password
 * @access Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { password: true },
  });

  if (!user) {
    throw new ApiError("User not found.", 404, "USER_NOT_FOUND");
  }

  // Check current password
  const isCurrentPasswordValid = await comparePassword(
    currentPassword,
    user.password
  );
  if (!isCurrentPasswordValid) {
    throw new ApiError(
      "Current password is incorrect.",
      400,
      "INVALID_CURRENT_PASSWORD"
    );
  }

  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      password: hashedNewPassword,
      updatedAt: new Date(),
    },
  });

  res.json({
    success: true,
    message: "Password changed successfully.",
  });
});

/**
 * Verify email
 * @route POST /api/auth/verify-email
 * @access Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  // Find user with verification token
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      email: true,
      isVerified: true,
    },
  });

  if (!user) {
    throw new ApiError(
      "Invalid or expired verification token.",
      400,
      "INVALID_VERIFICATION_TOKEN"
    );
  }

  if (user.isVerified) {
    throw new ApiError("Email is already verified.", 400, "ALREADY_VERIFIED");
  }

  // Verify user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      updatedAt: new Date(),
    },
  });

  res.json({
    success: true,
    message: "Email verified successfully.",
  });
});

/**
 * Resend verification email
 * @route POST /api/auth/resend-verification
 * @access Public
 */
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      isVerified: true,
    },
  });

  if (!user) {
    throw new ApiError("User not found.", 404, "USER_NOT_FOUND");
  }

  if (user.isVerified) {
    throw new ApiError("Email is already verified.", 400, "ALREADY_VERIFIED");
  }

  // Generate new verification token
  const emailVerificationToken = crypto.randomBytes(32).toString("hex");
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update user with new token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken,
      emailVerificationExpires,
      updatedAt: new Date(),
    },
  });

  res.json({
    success: true,
    message: "Verification email sent successfully.",
    meta: {
      verificationToken: emailVerificationToken, // In production, send this via email
    },
  });
});

/**
 * Forgot password - send reset token
 * @route POST /api/auth/forgot-password
 * @access Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    // Don't reveal if user exists or not
    return res.json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  }

  // Generate reset token
  const passwordResetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

  // Update user with reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken,
      passwordResetExpires,
      updatedAt: new Date(),
    },
  });

  res.json({
    success: true,
    message:
      "If an account with that email exists, a password reset link has been sent.",
    meta: {
      resetToken: passwordResetToken, // In production, send this via email
    },
  });
});

/**
 * Reset password with token
 * @route POST /api/auth/reset-password
 * @access Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Find user with reset token
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError(
      "Invalid or expired reset token.",
      400,
      "INVALID_RESET_TOKEN"
    );
  }

  // Hash new password
  const hashedPassword = await hashPassword(password);

  // Update password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    },
  });

  res.json({
    success: true,
    message: "Password reset successfully.",
  });
});

module.exports = {
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
};
