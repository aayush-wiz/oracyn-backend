const express = require("express");
const router = express.Router();
const {
  getAllChartsForUser,
  getChartById,
  createChart,
  deleteChart,
  getChartsByChat, // We need this for the older route if it's still used
} = require("../controllers/chartController");
const authMiddleware = require("../middleware/authMiddleware");

// Protect all chart-related routes
router.use(authMiddleware);

// Route for getting all charts for a user or creating a new chart
// GET /api/charts
// POST /api/charts
router.route("/").get(getAllChartsForUser).post(createChart);

// Route for getting or deleting a single chart by its specific ID
// GET /api/charts/:id
// DELETE /api/charts/:id
router.route("/:id").get(getChartById).delete(deleteChart);

// Optional: Keep this route if any part of your app still uses it
// GET /api/charts/chat/:chatId
router.route("/chat/:chatId").get(getChartsByChat);

module.exports = router;
