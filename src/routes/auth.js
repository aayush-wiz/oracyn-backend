const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/signup", authController.signup);
router.post("/signin", authController.signin);
router.get("/me", authController.getCurrentUser);
router.post("/signout", authController.signout);

module.exports = router;
