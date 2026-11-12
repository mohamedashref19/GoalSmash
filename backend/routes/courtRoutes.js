const express = require("express");
const courtController = require("../controllers/courtController");
const authController = require("../controllers/authControllers");
const {
  uploadCourtImages,
  processAndUploadCourtImages,
} = require("../utils/uploadMiddleware");

const router = express.Router();

router.get("/", courtController.getAllCourts);

router.use(authController.protect);

router.post(
  "/",
  authController.restrictTo("owner", "admin"),
  uploadCourtImages,
  processAndUploadCourtImages,
  courtController.createCourt,
);

router.patch(
  "/:id",
  authController.restrictTo("owner", "admin", "employee"),
  uploadCourtImages,
  processAndUploadCourtImages,
  courtController.updateCourt,
);

module.exports = router;
