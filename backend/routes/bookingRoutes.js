const express = require("express");
const bookingController = require("../controllers/bookingController");
const authController = require("../controllers/authControllers");

const router = express.Router();

router.use(authController.protect);

router
  .route("/")
  .get(bookingController.getAllBookings)
  .post(bookingController.createBooking);

router.route("/:id").get(bookingController.getBooking);

router.patch("/:id/cancel", bookingController.cancelBooking);
router.use(authController.restrictTo("owner", "admin", "employee"));

router.patch("/:id/payment", bookingController.updatePayment);

module.exports = router;
