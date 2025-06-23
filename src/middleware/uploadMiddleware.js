const multer = require("multer");
const path = require("path");

// THIS IS THE KEY FIX: Define the absolute path for the shared directory.
const uploadDir = "/shared/uploads/";

// Set up storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save files directly to the correct shared path.
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename to avoid conflicts
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 15000000 }, // 15MB limit
});

module.exports = upload;
