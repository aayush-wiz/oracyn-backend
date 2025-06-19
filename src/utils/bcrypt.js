const bcrypt = require("bcryptjs");

// Get salt rounds from environment or default to 12
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    if (!password) {
      throw new Error("Password is required");
    }

    if (typeof password !== "string") {
      throw new Error("Password must be a string");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    return hashedPassword;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
};

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match
 */
const comparePassword = async (password, hashedPassword) => {
  try {
    if (!password || !hashedPassword) {
      throw new Error("Both password and hash are required");
    }

    if (typeof password !== "string" || typeof hashedPassword !== "string") {
      throw new Error("Password and hash must be strings");
    }

    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    // Log the error but don't expose internal details
    console.error("Password comparison error:", error.message);
    return false;
  }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password) {
    errors.push("Password is required");
    return { isValid: false, errors };
  }

  if (typeof password !== "string") {
    errors.push("Password must be a string");
    return { isValid: false, errors };
  }

  // Minimum length
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Maximum length (to prevent DoS attacks)
  if (password.length > 128) {
    errors.push("Password must be less than 128 characters long");
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // At least one number
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // At least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Check for common weak passwords
  const commonPasswords = [
    "password",
    "123456",
    "123456789",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "12345678",
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push("Password is too common, please choose a stronger password");
  }

  // Check for sequential characters
  if (/123456|abcdef|qwerty/.test(password.toLowerCase())) {
    errors.push("Password should not contain sequential characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength: calculatePasswordStrength(password),
  };
};

/**
 * Calculate password strength score
 * @param {string} password - Password to analyze
 * @returns {Object} Strength analysis
 */
const calculatePasswordStrength = (password) => {
  let score = 0;
  let feedback = [];

  if (!password)
    return { score: 0, level: "Very Weak", feedback: ["Password is required"] };

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety scoring
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  // Bonus points for complexity
  if (password.length >= 20) score += 1;
  if (
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password
    )
  )
    score += 1;

  // Determine strength level
  let level = "Very Weak";
  if (score >= 7) level = "Very Strong";
  else if (score >= 5) level = "Strong";
  else if (score >= 3) level = "Medium";
  else if (score >= 1) level = "Weak";

  // Generate feedback
  if (password.length < 8) feedback.push("Use at least 8 characters");
  if (!/[a-z]/.test(password)) feedback.push("Add lowercase letters");
  if (!/[A-Z]/.test(password)) feedback.push("Add uppercase letters");
  if (!/\d/.test(password)) feedback.push("Add numbers");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    feedback.push("Add special characters");

  return { score, level, feedback };
};

/**
 * Generate a secure random password
 * @param {number} length - Desired password length (default: 16)
 * @param {Object} options - Options for password generation
 * @returns {string} Generated password
 */
const generateSecurePassword = (length = 16, options = {}) => {
  const {
    includeLowercase = true,
    includeUppercase = true,
    includeNumbers = true,
    includeSpecialChars = true,
    excludeSimilar = true,
  } = options;

  let charset = "";

  if (includeLowercase)
    charset += excludeSimilar
      ? "abcdefghijkmnopqrstuvwxyz"
      : "abcdefghijklmnopqrstuvwxyz";
  if (includeUppercase)
    charset += excludeSimilar
      ? "ABCDEFGHJKLMNPQRSTUVWXYZ"
      : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (includeNumbers) charset += excludeSimilar ? "23456789" : "0123456789";
  if (includeSpecialChars) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

  if (!charset) {
    throw new Error("At least one character type must be included");
  }

  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  return password;
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  calculatePasswordStrength,
  generateSecurePassword,
};
