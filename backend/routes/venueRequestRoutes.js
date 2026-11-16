const express = require("express");
const venueRequestController = require("../controllers/venueRequestController");
const authController = require("../controllers/authControllers");

const router = express.Router();

// يجب أن يكون المستخدم مسجلاً للدخول
router.use(authController.protect);

// مسار إرسال طلب من اللاعب أو صاحب الملعب
router.post("/", venueRequestController.createVenueRequest);

// المسارات التالية مخصصة للأدمن فقط
router.use(authController.restrictTo("admin"));

router.get("/", venueRequestController.getAllVenueRequests);
router.patch("/:id/status", venueRequestController.updateVenueRequestStatus);
router.delete("/:id", venueRequestController.deleteVenueRequest);

module.exports = router;
