const express = require("express");
const router = express.Router();
const {
  getChartsByChat,
  createChart,
  deleteChart,
} = require("../controllers/chartController");
const { protect } = require("../middleware/authMiddleware");

// Apply protect middleware to all chart routes
router.use(protect);

// Get all charts for a specific chat
router.route("/chat/:chatId").get(getChartsByChat);

// Create a new chart based on a prompt
router.route("/").post(createChart);

// Delete a chart by its ID
router.route("/:id").delete(deleteChart);

module.exports = router;
