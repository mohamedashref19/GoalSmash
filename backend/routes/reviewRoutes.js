const express = require("express");
const reviewController = require("../controllers/reviewController");
const authController = require("../controllers/authControllers");

const router = express.Router({ mergeParams: true });

// السماح للجميع بمشاهدة التقييمات
router.route("/").get(reviewController.getVenueReviews);

// حماية المسارات القادمة بحيث تتطلب تسجيل الدخول
router.use(authController.protect);

// العميل (customer) فقط من يستطيع إنشاء تقييم جديد
router
  .route("/")
  .post(authController.restrictTo("customer"), reviewController.createReview);

router
  .route("/:id")
  .patch(
    authController.restrictTo("customer"), // العميل فقط من يعدل تقييمه
    reviewController.updateReview,
  )
  .delete(
    reviewController.deleteReview, // الصلاحيات (أدمن، مالك، عميل) تتم إدارتها داخل الكنترولر نفسه
  );

module.exports = router;
