const express = require("express");
const adminController = require("../controllers/adminController");
const authController = require("../controllers/authControllers");

const router = express.Router();

router.use(authController.protect);
router.use(authController.restrictTo("admin"));

router.get("/overview", adminController.getPlatformOverview);
router.get("/venues-performance", adminController.getVenuesPerformance);

router.post("/owners", adminController.createOwner);
router.get("/owners", adminController.getAllOwners);
router.get("/customers", adminController.getAllCustomers);

module.exports = router;
