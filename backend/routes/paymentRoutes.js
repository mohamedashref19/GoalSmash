const express = require("express");
const paymentController = require("../controllers/paymentController");
const authControllers = require("../controllers/authControllers");
const smsWebhookAuth = require("../middleware/smsWebhookAuth");
const paymentAccountController = require("../controllers/paymentAccountController");

const router = express.Router();

router.post(
  "/webhook/sms",
  smsWebhookAuth.verifySmsWebhook,
  paymentController.receivePaymentSms,
);
router.use(authControllers.protect);
router.get(
  "/accounts/available",
  paymentAccountController.getAvailablePaymentAccount,
);
router.get(
  "/reports",
  authControllers.restrictTo("owner", "admin", "employee"),
  paymentController.getFinancialReports,
);

router.get("/:id/status", paymentController.getPaymentStatus);
router.patch(
  "/:id/proof",
  paymentController.uploadProofImage,
  paymentController.submitPaymentProof,
);
router.use("/accounts", authControllers.restrictTo("admin"));
router
  .route("/accounts")
  .get(paymentAccountController.getAllAccounts)
  .post(paymentAccountController.createAccount);

router
  .route("/accounts/:id")
  .patch(paymentAccountController.updateAccount)
  .delete(paymentAccountController.deleteAccount);

router.patch(
  "/accounts/:id/toggle",
  paymentAccountController.toggleAccountStatus,
);
router.use(authControllers.restrictTo("owner", "admin", "employee"));

router.get("/", paymentController.getAllPayments);
router.get("/unmatched", paymentController.getUnmatchedPayments);
router.patch("/:id/verify", paymentController.manuallyVerifyPayment);
router.patch(
  "/unmatched/:id/process",
  paymentController.processUnmatchedPayment,
);
router.patch("/:id/note", paymentController.addPaymentNote);
module.exports = router;
