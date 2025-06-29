// utils/tokens.js
const jwt = require("jsonwebtoken");

// Generate access and refresh tokens
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "15m",
    issuer: "your-app-name",
    audience: "your-app-users",
  });

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
      issuer: "your-app-name",
      audience: "your-app-users",
    }
  );

  return { accessToken, refreshToken };
};

// Verify and decode token
const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

// Get token expiration time
const getTokenExpiration = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.exp ? new Date(decoded.exp * 1000) : null;
  } catch (error) {
    return null;
  }
};

// Check if token is expired
const isTokenExpired = (token) => {
  const expiration = getTokenExpiration(token);
  return expiration ? expiration < new Date() : true;
};

// Generate password reset token
const generatePasswordResetToken = (userId) => {
  return jwt.sign({ userId, type: "password-reset" }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

// Generate email verification token
const generateEmailVerificationToken = (userId, email) => {
  return jwt.sign(
    { userId, email, type: "email-verification" },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

module.exports = {
  generateTokens,
  verifyToken,
  getTokenExpiration,
  isTokenExpired,
  generatePasswordResetToken,
  generateEmailVerificationToken,
};
