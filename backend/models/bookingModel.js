const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.ObjectId,
      ref: "Venue",
      required: [true, "يجب تحديد المكان الخاص بالحجز"],
    },
    court: {
      type: mongoose.Schema.ObjectId,
      ref: "Court",
      required: [true, "يجب تحديد الملعب"],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    guestData: {
      name: String,
      phone: String,
    },
    bookingType: {
      type: String,
      // +++ تمت إضافة maintenance و academy +++
      enum: ["app", "manual", "maintenance", "academy"],
      required: [true, "يجب تحديد نوع الحجز"],
    },
    deposit: {
      type: Number,
      default: 0,
    },
    startTime: {
      type: Date,
      required: [true, "يجب تحديد وقت بداية الحجز"],
    },
    endTime: {
      type: Date,
      required: [true, "يجب تحديد وقت نهاية الحجز"],
    },
    totalPrice: {
      type: Number,
      required: [true, "يجب تحديد السعر الإجمالي للحجز"],
    },
    commission: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      // +++ تمت إضافة blocked للإغلاقات الإدارية +++
      enum: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "completed",
        "expired",
        "blocked",
      ],
      default: "pending_payment",
    },
    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    cancellationReason: {
      // اختياري، لمعرفة سبب الإلغاء
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "vodafone_cash", "instapay", "card"],
      default: "cash",
    },
    notes: String,
    // +++ حقل جديد لمعرفة إذا كان الإغلاق جزء من سلسلة متكررة +++
    recurrenceId: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

bookingSchema.index({
  court: 1,
  startTime: 1,
  endTime: 1,
  status: 1,
});

bookingSchema.pre(/^find/, function () {
  this.populate({
    path: "court",
    select: "name sportType pricePerHour",
  }).populate({
    path: "user",
    select: "name phone",
  });
});

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
