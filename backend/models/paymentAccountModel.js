const mongoose = require("mongoose");

const paymentAccountSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["vodafone_cash", "instapay"],
      required: [true, "يجب تحديد نوع الحساب"],
    },
    identifier: {
      type: String,
      required: [true, "يجب إدخال رقم المحفظة أو عنوان الإنستا باي"],
      unique: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: [true, "يجب إدخال اسم صاحب الحساب ليظهر للعميل"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    lastTransferReceivedAt: {
      type: Date,
    },
    totalMoneyCollected: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

const PaymentAccount = mongoose.model("PaymentAccount", paymentAccountSchema);
module.exports = PaymentAccount;
