const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const authController = require("../controllers/authControllers");

const router = express.Router();

router.use(authController.protect);
router.use(authController.restrictTo("owner", "admin"));

router.get("/today-stats", dashboardController.getTodayStats);
router.get("/top-customers", dashboardController.getTopCustomers);

module.exports = router;
