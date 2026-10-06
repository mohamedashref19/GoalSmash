const crypto = require("crypto");
const AppError = require("../utils/appError");

exports.verifySmsWebhook = (req, res, next) => {
  const secret = process.env.SMS_WEBHOOK_SECRET;
  const authHeader = req.headers.authorization;

  // لو الـ secret مش متضبط في .env نرفض كل الطلبات.
  // قبل كده الهيدر "Bearer undefined" كان بيعدّي، وأي حد كان يقدر يأكد دفع.
  if (!secret || typeof authHeader !== "string") {
    return next(new AppError("Unauthorized - غير مصرح لك", 401));
  }

  // مقارنة بزمن ثابت (=== بتسرّب معلومات من زمن الرد)
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authHeader);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return next(new AppError("Unauthorized - غير مصرح لك", 401));
  }

  next();
};
