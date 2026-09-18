const AppError = require("../utils/appError");

const handleErrorCastDB = (err) => {
  const value =
    err.stringValue ||
    (typeof err.value === "object" ? JSON.stringify(err.value) : err.value);
  const message = `Invalid ${err.path}: ${value}`;
  return new AppError(message, 400);
};

const handleDuplicateDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = Object.values(err.keyValue)[0];
  const message = `${field} "${value}" already exists. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidatorErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid data: ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError("Invalid Token! Please log in again.", 401);
const handleExpiredError = () =>
  new AppError("Your Token has expired! Please log in again.", 401);

const sendErrDev = (err, req, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrProd = (err, req, res) => {
  // 1)Operational
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // 2)Programming/Unknown Bugs
  console.error("ERROR 💥", err);

  return res.status(500).json({
    status: "error",
    message: "Something went very wrong!",
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  const env = process.env.NODE_ENV
    ? process.env.NODE_ENV.trim()
    : "development";

  if (env === "development") {
    sendErrDev(err, req, res);
  } else if (env === "production") {
    let error = Object.assign(err);

    error.message = err.message;
    error.name = err.name;

    if (error.name === "CastError") error = handleErrorCastDB(error);
    if (error.code === 11000) error = handleDuplicateDB(error);
    if (error.name === "ValidationError") error = handleValidatorErrorDB(error);
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleExpiredError();

    sendErrProd(error, req, res);
  }
};
