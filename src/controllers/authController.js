const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { getDB, getAuth } = require("../config/firebase");
const logger = require("../utils/logger");

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email, password, firstName, lastName } = req.body;
      const db = getDB();
      const auth = getAuth();

      // Check if user already exists in Firestore
      const usersSnapshot = await db
        .collection("users")
        .where("email", "==", email)
        .get();
      if (!usersSnapshot.empty) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Create user in Firebase Auth
      let firebaseUser;
      try {
        firebaseUser = await auth.createUser({
          email,
          password,
          displayName: `${firstName} ${lastName}`,
        });
      } catch (firebaseError) {
        logger.error("Firebase user creation failed:", firebaseError);
        return res.status(400).json({
          success: false,
          message: "Failed to create user account",
          error: firebaseError.message,
        });
      }

      // Hash password for local storage
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user document in Firestore
      const userData = {
        firebaseUid: firebaseUser.uid,
        email,
        firstName,
        lastName,
        hashedPassword,
        role: "user",
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true,
      };

      const userRef = await db.collection("users").add(userData);

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: userRef.id,
          email,
          firebaseUid: firebaseUser.uid,
          role: "user",
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: userRef.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
      );

      logger.info(`User registered successfully: ${email}`);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token,
        refreshToken,
        user: {
          id: userRef.id,
          email,
          firstName,
          lastName,
          role: "user",
        },
      });
    } catch (error) {
      logger.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Registration failed",
        error: error.message,
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;
      const db = getDB();

      // Find user in Firestore
      const usersSnapshot = await db
        .collection("users")
        .where("email", "==", email)
        .get();
      if (usersSnapshot.empty) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();

      // Check if user is active
      if (!userData.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        userData.hashedPassword
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Update last login
      await userDoc.ref.update({ lastLoginAt: new Date() });

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: userDoc.id,
          email: userData.email,
          firebaseUid: userData.firebaseUid,
          role: userData.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: userDoc.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
      );

      logger.info(`User logged in successfully: ${email}`);

      res.json({
        success: true,
        message: "Login successful",
        token,
        refreshToken,
        user: {
          id: userDoc.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed",
        error: error.message,
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token required",
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const db = getDB();

      // Get user data
      const userDoc = await db.collection("users").doc(decoded.userId).get();
      if (!userDoc.exists) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      const userData = userDoc.data();

      // Generate new access token
      const token = jwt.sign(
        {
          userId: userDoc.id,
          email: userData.email,
          firebaseUid: userData.firebaseUid,
          role: userData.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      res.json({
        success: true,
        token,
      });
    } catch (error) {
      logger.error("Token refresh error:", error);
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      logger.info(`User logged out: ${req.user.email}`);
      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      logger.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const db = getDB();
      const userDoc = await db.collection("users").doc(req.user.id).get();

      if (!userDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const userData = userDoc.data();

      res.json({
        success: true,
        user: {
          id: userDoc.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          createdAt: userData.createdAt,
          lastLoginAt: userData.lastLoginAt,
        },
      });
    } catch (error) {
      logger.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get user profile",
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { firstName, lastName } = req.body;
      const db = getDB();

      const updateData = {};
      if (firstName) updateData.firstName = firstName.trim();
      if (lastName) updateData.lastName = lastName.trim();
      updateData.updatedAt = new Date();

      await db.collection("users").doc(req.user.id).update(updateData);

      logger.info(`User profile updated: ${req.user.email}`);

      res.json({
        success: true,
        message: "Profile updated successfully",
      });
    } catch (error) {
      logger.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  }
}

module.exports = new AuthController();
