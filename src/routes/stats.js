const express = require("express");
const router = express.Router();
const { getStats } = require("../controllers/statsController");
const authMiddleware = require("../middleware/authMiddleware");

// All routes in this file are protected
router.use(authMiddleware);

// Defines the GET endpoint at the root of this router (which will be /api/stats)
router.route("/").get(getStats);

module.exports = router;
