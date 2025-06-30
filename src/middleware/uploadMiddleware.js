const multer = require("multer");

// Use memoryStorage to handle the file as a buffer in memory.
// This is more efficient for this use case and avoids all file system
// permission and pathing errors, whether running locally or in Docker.
const storage = multer.memoryStorage();

// Initialize upload with the new storage engine and file size limit.
const upload = multer({
  storage: storage,
  limits: { fileSize: 15000000 }, // 15MB limit
});

module.exports = upload;
