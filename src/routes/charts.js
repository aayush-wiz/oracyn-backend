const express = require("express");
const router = express.Router();
const {
  getChartsByChat,
  createChart,
  deleteChart,
  getAllChartsForUser,
  getChartById,
} = require("../controllers/chartController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// NEW: Get all charts for the logged-in user
router.route("/").get(getAllChartsForUser).post(createChart);

// Get a single chart by its ID
router.route("/:id").get(getChartById).delete(deleteChart);

// Get all charts for a specific chat
router.route("/chat/:chatId").get(getChartsByChat);

module.exports = router;
