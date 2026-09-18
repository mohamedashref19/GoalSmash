const AppError = require("../utils/appError");

exports.verifySmsWebhook = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (
    !authHeader ||
    authHeader !== `Bearer ${process.env.SMS_WEBHOOK_SECRET}`
  ) {
    return next(new AppError("Unauthorized - غير مصرح لك", 401));
  }

  next();
};
