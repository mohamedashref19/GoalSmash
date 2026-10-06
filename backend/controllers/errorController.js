const AppError = require("../utils/appError");
const Sentry = require("@sentry/node");

const handleErrorCastDB = (err) => {
  const value =
    err.stringValue ||
    (typeof err.value === "object" ? JSON.stringify(err.value) : err.value);
  const message = `القيمة غير صالحة ${err.path}: ${value}`;
  return new AppError(message, 400);
};

const handleDuplicateDB = (err) => {
  // keyValue ممكن تكون ناقصة في بعض الإصدارات: بدون الحماية دي الـ handler نفسه بيقع
  const field = Object.keys(err.keyValue || {})[0];
  let message = "البيانات المدخلة مسجلة مسبقاً، يرجى استخدام قيمة أخرى.";

  if (field === "email") {
    message = "البريد الإلكتروني مستخدم بالفعل، يرجى استخدام بريد آخر.";
  } else if (field === "phone") {
    message = "رقم الهاتف مستخدم بالفعل، يرجى استخدام رقم آخر.";
  } else if (field === "name") {
    message = "هذا الاسم مستخدم مسبقاً، يرجى اختيار اسم آخر.";
  }

  return new AppError(message, 400);
};

const handleValidatorErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `بيانات غير صالحة: ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError("توكن غير صالح! يرجى تسجيل الدخول مرة أخرى.", 401);

const handleExpiredError = () =>
  new AppError("انتهت صلاحية الجلسة! يرجى تسجيل الدخول مرة أخرى.", 401);

// أخطاء رفع الملفات (حجم كبير، حقول زيادة...) كانت بتطلع 500
const handleMulterError = (err) => {
  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? "حجم الصورة كبير جداً (الحد الأقصى 5 ميجا)"
      : "تعذر رفع الملف، تأكد من الصورة وحاول مرة أخرى";
  return new AppError(message, 400);
};

// JSON مكسور أو body كبير: ده خطأ من العميل (4xx) مش خطأ سيرفر
const handleBodyParserError = (err) =>
  err.type === "entity.too.large"
    ? new AppError("حجم البيانات المرسلة كبير جداً", 413)
    : new AppError("البيانات المرسلة غير صالحة", 400);

const sendErrDev = (err, req, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrProd = (err, req, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  console.error("ERROR 💥", err);

  return res.status(500).json({
    status: "error",
    message: "حدث خطأ غير متوقع في الخادم!",
  });
};

module.exports = (err, req, res, next) => {
  // لو الرد اتبعت خلاص (زي forgetPassword)، نسيب Express يقفل الاتصال
  if (res.headersSent) return next(err);

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = err;

  if (error.name === "CastError") error = handleErrorCastDB(error);
  if (error.code === 11000) error = handleDuplicateDB(error);
  if (error.name === "ValidationError") error = handleValidatorErrorDB(error);
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleExpiredError();
  if (error.name === "MulterError") error = handleMulterError(error);
  if (
    error.type === "entity.parse.failed" ||
    error.type === "entity.too.large"
  ) {
    error = handleBodyParserError(error);
  }

  // Sentry: أخطاء السيرفر والأخطاء غير المتوقعة بس.
  // أخطاء العميل المتوقعة (401/404/validation) كانت بتملا الـ quota وتخفي الأخطاء الحقيقية.
  if (!error.isOperational || error.statusCode >= 500) {
    Sentry.captureException(err);
  }

  // لو NODE_ENV مش متضبط نفترض production (الافتراضي القديم "development" كان
  // بيكشف stack trace وتفاصيل الداتابيز للمستخدمين لو نسيت تضبطه على السيرفر)
  const env = process.env.NODE_ENV ? process.env.NODE_ENV.trim() : "production";

  if (env === "development") {
    sendErrDev(error, req, res);
  } else {
    sendErrProd(error, req, res);
  }
};
