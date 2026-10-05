const express = require("express");
const courtController = require("../controllers/courtController");
const authController = require("../controllers/authControllers");
const {
  uploadVenueImage,
  processAndUploadImage,
} = require("../utils/uploadMiddleware");

const router = express.Router();

router.get("/", courtController.getAllCourts);

router.use(authController.protect);

router.use(authController.restrictTo("owner", "admin"));

router.post(
  "/",
  uploadVenueImage,
  processAndUploadImage,
  courtController.createCourt,
);
router.patch(
  "/:id",
  uploadVenueImage,
  processAndUploadImage,
  courtController.updateCourt,
);

module.exports = router;
