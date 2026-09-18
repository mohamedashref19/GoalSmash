const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    paymentReference: {
      type: String,
      required: true,
      unique: true,
    },

    method: {
      type: String,
      enum: ["vodafone_cash", "instapay", "cash"],
      required: true,
    },

    baseAmount: {
      type: Number,
      required: true,
    },

    expectedAmount: {
      type: Number,
      required: true,
    },

    amountReceived: Number,

    senderPhone: String,

    senderName: String,

    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    proofImage: String,
    manualTransactionId: String,
    status: {
      type: String,
      enum: [
        "pending",
        "pending_verification",
        "verified",
        "rejected",
        "expired",
      ],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    verifiedAt: Date,

    verificationMethod: {
      type: String,
      enum: ["sms_auto", "admin", "gateway"],
    },

    smsEventId: {
      type: String,
      unique: true,
      sparse: true,
    },

    receivedAt: Date,

    rawPaymentData: String,

    verificationNotes: String,
  },
  {
    timestamps: true,
  },
);
paymentSchema.index({
  expectedAmount: 1,
  method: 1,
  status: 1,
  expiresAt: 1,
});
const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
