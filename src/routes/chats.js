const express = require("express");
const router = express.Router();
const {
  getChats,
  createChat,
  getChatById,
  deleteChat,
  addMessage,
  updateTitle,
  uploadDocumentAndTriggerWorkflow,
} = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Apply protect middleware to all chat routes
router.use(authMiddleware);

// Routes for chats
router.route("/")
  .get(getChats)
  .post(createChat);
router.route("/:id")
  .get(getChatById)
  .delete(deleteChat);

// Route for updating a chat's title
router.route("/:id").put(updateTitle);

// Route for messages within a chat
router.route("/:chatId/messages").post(addMessage);

// Route for deleting a chat
router.route("/:id").delete(deleteChat);

// Route for uploading documents to a chat
router
  .route("/:chatId/documents")
  .post(upload.single("document"), uploadDocumentAndTriggerWorkflow);

module.exports = router;
