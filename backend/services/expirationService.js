const cron = require("node-cron");
const Payment = require("../models/paymentModel");
const Booking = require("../models/bookingModel");

const expirePendingPayments = async () => {
  try {
    const now = new Date();

    const expiredPayments = await Payment.find({
      status: {
        $in: ["pending", "pending_verification"],
      },

      expiresAt: {
        $lte: now,
      },
    }).select("_id booking");

    if (expiredPayments.length === 0) return;

    for (const expiredPayment of expiredPayments) {
      // تحديث الدفع بشكل Atomic
      // لن يتم تغيير حالة الدفع إذا تم تأكيده في نفس اللحظة
      const payment = await Payment.findOneAndUpdate(
        {
          _id: expiredPayment._id,

          status: {
            $in: ["pending", "pending_verification"],
          },

          expiresAt: {
            $lte: now,
          },
        },

        {
          $set: {
            status: "expired",
          },
        },

        {
          returnDocument: "after",
        },
      );

      // إذا لم نجد Payment فهذا يعني أنه تم تحديثه
      // بواسطة Webhook مثلاً قبل أن يصل الـ Cron إليه
      if (!payment) {
        continue;
      }

      // تحديث الحجز فقط إذا كان ما زال في انتظار الدفع
      const booking = await Booking.findOneAndUpdate(
        {
          _id: payment.booking,

          status: "pending_payment",
        },

        {
          $set: {
            status: "expired",
            paymentStatus: "unpaid",
          },
        },

        {
          returnDocument: "after",
        },
      );

      if (booking) {
        console.log(
          `Booking number ${payment.booking} has been cancelled due to the payment deadline.`,
        );
      }
    }
  } catch (error) {
    console.error("خطأ أثناء تنفيذ خدمة إلغاء الحجوزات المنتهية:", error);
  }
};

// تشغيل الخدمة
const startExpirationJob = () => {
  // تشغيل مرة مباشرة عند بدء السيرفر
  expirePendingPayments();

  // ثم تشغيل كل دقيقة
  cron.schedule("* * * * *", async () => {
    await expirePendingPayments();
  });

  console.log(
    "The cancellation service for expired bookings (Cron Job) has been activated.",
  );
};

module.exports = startExpirationJob;
