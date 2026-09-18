const express = require("express");
const courtController = require("../controllers/courtController");
const authController = require("../controllers/authControllers");
const { uploadVenueImage } = require("../utils/uploadMiddleware");

const router = express.Router();

router.get("/", courtController.getAllCourts);

router.use(authController.protect);

router.use(authController.restrictTo("owner", "admin"));

router.post("/", uploadVenueImage, courtController.createCourt);
router.patch("/:id", uploadVenueImage, courtController.updateCourt);

module.exports = router;
