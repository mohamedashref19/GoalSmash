const express = require("express");
const venueController = require("../controllers/venueController");
const authController = require("../controllers/authControllers");
const reviewRouter = require("./reviewRoutes"); // +++ إضافة الـ Router الخاص بالتقييمات +++
const {
  uploadVenueImage,
  processAndUploadImage,
} = require("../utils/uploadMiddleware");

const router = express.Router();

// +++ تفعيل المسارات المتداخلة (Nested Routes) للتقييمات الخاصة بملعب محدد +++
router.use("/:venueId/reviews", reviewRouter);

// المسارات الحالية التي يجب أن تظل مفتوحة للجميع (مثلاً في تطبيق العميل)
router.route("/").get(venueController.getAllVenues);
router.route("/:id").get(venueController.getVenue);

router.use(authController.protect);
router.use(authController.restrictTo("owner", "admin"));

router
  .route("/")
  .post(uploadVenueImage, processAndUploadImage, venueController.createVenue);
router
  .route("/:id")
  .patch(uploadVenueImage, processAndUploadImage, venueController.updateVenue);

module.exports = router;
