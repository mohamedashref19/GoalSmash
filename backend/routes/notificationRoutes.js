const express = require("express");
const notificationController = require("../controllers/notificationController");
const authController = require("../controllers/authControllers");

const router = express.Router();

router.use(authController.protect);

router.route("/").get(notificationController.getMyNotifications);

router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);

module.exports = router;
