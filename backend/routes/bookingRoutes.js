const express = require("express");
const bookingController = require("../controllers/bookingController");
const authController = require("../controllers/authControllers");

const router = express.Router();

router.use(authController.protect);

router
  .route("/")
  .get(bookingController.getAllBookings)
  .post(bookingController.createBooking);

router
  .route("/block-slots")
  .get(authController.restrictTo("admin"), bookingController.getAllBlocks)
  .post(authController.restrictTo("admin"), bookingController.blockCourtSlots);
router.delete(
  "/block-slots/:id",
  authController.restrictTo("admin"),
  bookingController.deleteBlock,
);

router.route("/:id").get(bookingController.getBooking);

router.patch("/:id/cancel", bookingController.cancelBooking);
router.use(authController.restrictTo("owner", "admin", "employee"));

router.patch("/:id/payment", bookingController.updatePayment);

module.exports = router;
