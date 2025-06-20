const express = require("express");
const router = express.Router();
const {
  getChartsByChat,
  createChart,
  updateChart,
  deleteChart,
} = require("../controllers/chartController");
const { protect } = require("../middleware/authMiddleware");

// Apply protect middleware to all chart routes
router.use(protect);

router.route("/chat/:chatId").get(getChartsByChat);
router.route("/").post(createChart);
router.route("/:id").put(updateChart).delete(deleteChart);

module.exports = router;
