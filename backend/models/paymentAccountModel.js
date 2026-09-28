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
      // unique: true,  <--- 1. قم بحذف أو إيقاف هذا السطر
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

// 2. +++ أضف هذا السطر هنا +++
// هذا السطر يضمن أنك لا تستطيع إضافة نفس الرقم مرتين لنفس النوع (مثلاً اثنين فودافون كاش بنفس الرقم)،
// لكن يسمح بإضافة نفس الرقم مرة كفودافون ومرة كإنستا باي.
paymentAccountSchema.index({ identifier: 1, type: 1 }, { unique: true });

const PaymentAccount = mongoose.model("PaymentAccount", paymentAccountSchema);
module.exports = PaymentAccount;
