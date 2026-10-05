const cron = require("node-cron");
const Payment = require("../models/paymentModel");
const Booking = require("../models/bookingModel");

const expirePendingPayments = async () => {
  try {
    const now = new Date();

    // +++ التعديل 1: إضافة Limit لحماية الذاكرة (RAM) +++
    // معالجة 100 طلب كحد أقصى في الدقيقة لمنع السيرفر من الانهيار إذا تراكمت الحجوزات
    const expiredPayments = await Payment.find({
      status: {
        $in: ["pending", "pending_verification"],
      },
      expiresAt: {
        $lte: now,
      },
    })
      .select("_id booking")
      .limit(100);

    if (expiredPayments.length === 0) return;

    let cancelledCount = 0; // +++ التعديل 2: مجمع للسجلات لمنع ازدحام الكونسول +++

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
        cancelledCount++;
      }
    }

    if (cancelledCount > 0) {
      console.log(
        `🧹 [CRON] تم إلغاء عدد ${cancelledCount} حجز لانتهاء مهلة الدفع بنجاح.`,
      );
    }
  } catch (error) {
    // تسجيل الخطأ بصمت دون إيقاف السيرفر
    console.error(
      "⚠️ [CRON ERROR] خطأ أثناء تنفيذ خدمة إلغاء الحجوزات المنتهية:",
      error.message,
    );
  }
};

// تشغيل الخدمة
const startExpirationJob = () => {
  // +++ التعديل 3: تأمين التشغيل المبدئي بـ catch لمنع سقوط السيرفر عند الإقلاع +++
  expirePendingPayments().catch((err) =>
    console.error(
      "⚠️ [CRON START ERROR] فشل التشغيل المبدئي للخدمة:",
      err.message,
    ),
  );

  // ثم تشغيل كل دقيقة
  cron.schedule("* * * * *", async () => {
    await expirePendingPayments();
  });

  console.log(
    "✅ The cancellation service for expired bookings (Cron Job) has been activated.",
  );
};

module.exports = startExpirationJob;
