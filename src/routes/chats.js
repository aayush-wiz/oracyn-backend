const express = require("express");
const router = express.Router();
const {
  getChats,
  createChat,
  getChatById,
  deleteChat,
  addMessage,
  uploadDocumentAndTriggerWorkflow,
} = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Apply protect middleware to all chat routes
router.use(authMiddleware);

// Routes for chats
router.route("/").get(getChats).post(createChat);
router.route("/:id").get(getChatById).delete(deleteChat);

// Route for messages within a chat
router.route("/:chatId/messages").post(addMessage);

// Route for uploading documents to a chat
router
  .route("/:chatId/documents")
  .post(upload.single("document"), uploadDocumentAndTriggerWorkflow);

module.exports = router;
