const express = require("express");
const venueController = require("../controllers/venueController");
const authController = require("../controllers/authControllers");
const { uploadVenueImage } = require("../utils/uploadMiddleware");

const router = express.Router();

router.use(authController.protect);

router.route("/").get(venueController.getAllVenues);
router.route("/:id").get(venueController.getVenue);

router.use(authController.restrictTo("owner", "admin"));

router.route("/").post(uploadVenueImage, venueController.createVenue);
router.route("/:id").patch(uploadVenueImage, venueController.updateVenue);

module.exports = router;
