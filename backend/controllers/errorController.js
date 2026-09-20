const AppError = require("../utils/appError");

const handleErrorCastDB = (err) => {
  const value =
    err.stringValue ||
    (typeof err.value === "object" ? JSON.stringify(err.value) : err.value);
  const message = `القيمة غير صالحة ${err.path}: ${value}`;
  return new AppError(message, 400);
};

const handleDuplicateDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
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
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = Object.assign(err);
  error.message = err.message;
  error.name = err.name;

  if (error.name === "CastError") error = handleErrorCastDB(error);
  if (error.code === 11000) error = handleDuplicateDB(error);
  if (error.name === "ValidationError") error = handleValidatorErrorDB(error);
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleExpiredError();

  const env = process.env.NODE_ENV
    ? process.env.NODE_ENV.trim()
    : "development";

  if (env === "development") {
    sendErrDev(error, req, res);
  } else {
    sendErrProd(error, req, res);
  }
};
