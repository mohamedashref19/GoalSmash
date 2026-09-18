const mongoose = require("mongoose");

const unmatchedPaymentSchema = new mongoose.Schema(
  {
    sender: String,
    message: String,
    amount: Number,
    method: String,
    senderPhone: String,
    transactionId: String,
    receivedAt: Date,
    processed: {
      type: Boolean,
      default: false,
    },
    adminNote: String,
  },
  {
    timestamps: true,
  },
);

const UnmatchedPayment = mongoose.model(
  "UnmatchedPayment",
  unmatchedPaymentSchema,
);

module.exports = UnmatchedPayment;
