const cron = require("node-cron");
const Booking = require("../models/bookingModel");
const Venue = require("../models/venueModel");
const Email = require("./email");

const startCronJobs = () => {
  cron.schedule(
    "0 6 * * *",
    async () => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const venues = await Venue.find().populate("owner");
        let emailsSent = 0;

        for (const venue of venues) {
          if (!venue.owner || !venue.owner.email) {
            continue;
          }

          const todayBookings = await Booking.find({
            venue: venue._id,
            status: "confirmed",
            startTime: { $gte: startOfDay, $lte: endOfDay },
          })
            .populate("user court")
            .sort("startTime"); // رتبناها بالوقت عشان تظهر بالترتيب

          if (todayBookings.length === 0) {
            continue;
          }

          let emailBody = `<h2 style="color:#1f3d2b; font-size:20px; border-bottom: 2px solid #28a745; padding-bottom: 10px;">جدول حجوزات اليوم (${startOfDay.toLocaleDateString("ar-EG")})</h2>`;

          todayBookings.forEach((b, index) => {
            // حساب الوقت والمدة
            const startTime = new Date(b.startTime);
            const endTime = new Date(b.endTime);
            const timeStr = startTime.toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const durationMinutes = Math.round(
              (endTime - startTime) / (1000 * 60),
            );
            let durationText = `${durationMinutes} دقيقة`;
            if (durationMinutes === 60) durationText = "ساعة";
            else if (durationMinutes === 90) durationText = "ساعة ونصف";
            else if (durationMinutes === 120) durationText = "ساعتين";

            const clientName = b.user?.name || b.guestData?.name || "بدون اسم";

            // الحسابات المالية
            const price = b.totalPrice || 0;
            const deposit = b.deposit || 0;
            const remaining = Math.max(price - deposit, 0);

            // تنسيق الحالة المالية
            let paymentInfo = "";
            if (remaining > 0) {
              paymentInfo = `<span style="color:#d9534f;">دفع عربون: <strong>${deposit} ج.م</strong> | يُدفع بالملعب: <strong>${remaining} ج.م</strong></span>`;
            } else {
              paymentInfo = `<span style="color:#28a745;"><strong>خالص ومسدد بالكامل (${price} ج.م)</strong></span>`;
            }

            // تصميم بلوك الحجز
            emailBody += `
              <div style="background:#f9f9f9; padding:15px; margin-bottom:12px; border-radius:10px; border:1px solid #e0e0e0; text-align:right;">
                <p style="margin:0 0 8px; font-size:16px;">
                  <strong style="color:#1f3d2b;">${index + 1}. الملعب:</strong> ${b.court.name}
                </p>
                <p style="margin:0 0 8px; font-size:14px; color:#555;">
                  <strong>الوقت:</strong> ${timeStr} &nbsp;|&nbsp; <strong>المدة:</strong> ${durationText}
                </p>
                <p style="margin:0 0 8px; font-size:14px; color:#555;">
                  <strong>العميل:</strong> ${clientName}
                </p>
                <p style="margin:0; font-size:14px; border-top:1px dashed #ccc; padding-top:8px;">
                  ${paymentInfo}
                </p>
              </div>
            `;
          });

          const ownerEmail = new Email(venue.owner, process.env.FRONTEND_URL);
          await ownerEmail.send(`جدول حجوزات اليوم - ${venue.name}`, emailBody);
          emailsSent++;
        }
      } catch (err) {
        console.error("خطأ في إرسال جداول الطوارئ:", err);
      }
    },
    {
      timezone: "Africa/Cairo",
    },
  );
};

module.exports = startCronJobs;
