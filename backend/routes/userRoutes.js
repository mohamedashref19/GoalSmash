const express = require("express");
const authController = require("../controllers/authControllers");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/verify-otp", authController.verifyOTP);
router.post("/resend-otp", authController.resendOTP);

router.post("/forget-password", authController.forgetPassword);
router.patch("/reset-password", authController.resetPassword);

router.use(authController.protect);

router.get("/logout", authController.logout);
router.patch("/update-password", authController.updatePassword);
router.patch("/update-me", authController.updateMe);

module.exports = router;
