const admin = require("firebase-admin");
const logger = require("../utils/logger");

let db = null;

const connectFirebase = async () => {
  try {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri:
          process.env.FIREBASE_AUTH_URI ||
          "https://accounts.google.com/o/oauth2/auth",
        token_uri:
          process.env.FIREBASE_TOKEN_URI ||
          "https://oauth2.googleapis.com/token",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
          process.env.FIREBASE_CLIENT_EMAIL
        )}`,
      };

      // Validate required fields
      if (!serviceAccount.project_id) {
        throw new Error("FIREBASE_PROJECT_ID is required");
      }
      if (!serviceAccount.private_key) {
        throw new Error("FIREBASE_PRIVATE_KEY is required");
      }
      if (!serviceAccount.client_email) {
        throw new Error("FIREBASE_CLIENT_EMAIL is required");
      }

      logger.info(
        "Initializing Firebase with project:",
        serviceAccount.project_id
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }

    // Initialize Firestore
    db = admin.firestore();

    // Configure Firestore settings
    db.settings({
      timestampsInSnapshots: true,
    });

    logger.info("Firebase Admin SDK initialized successfully");
    return db;
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    throw error;
  }
};

const getDB = () => {
  if (!db) {
    throw new Error("Firestore not initialized. Call connectFirebase() first.");
  }
  return db;
};

const getAuth = () => {
  return admin.auth();
};

module.exports = {
  connectFirebase,
  getDB,
  getAuth,
  admin,
};
