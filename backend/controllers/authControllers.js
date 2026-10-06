const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require("../utils/email");

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

// OTP آمن تشفيرياً (Math.random قابل للتوقع)
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

// وقت إصدار الكود الحالي = وقت انتهائه - مدة الصلاحية. بنستخدمه كفترة انتظار بين الإرسالات
// (بدون ما نضيف حقول جديدة للموديل). new Date() بتشتغل سواء الحقل Date أو Number.
const issuedRecently = (expires) =>
  !!expires &&
  new Date(expires).getTime() - OTP_TTL_MS >
    Date.now() - OTP_RESEND_COOLDOWN_MS;

// عدّاد المحاولات الفاشلة لكل إيميل: بيمنع تخمين الـ OTP حتى لو المهاجم بيبدّل الـ IP.
// في الذاكرة، مناسب لعملية PM2 واحدة (fork mode). لو شغّلت cluster انقله لـ Redis/DB.
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;
const otpFailures = new Map();

const isOtpLocked = (key) => {
  const entry = otpFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    otpFailures.delete(key);
    return false;
  }
  return entry.count >= MAX_OTP_ATTEMPTS;
};

const registerOtpFailure = (key) => {
  const now = Date.now();
  const entry = otpFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    otpFailures.set(key, { count: 1, resetAt: now + OTP_LOCK_MS });
  } else {
    entry.count += 1;
  }
};

const clearOtpFailures = (key) => otpFailures.delete(key);

setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of otpFailures) {
      if (entry.resetAt <= now) otpFailures.delete(key);
    }
  },
  10 * 60 * 1000,
).unref();

// الـ OTP ممكن يوصل كنص أو رقم
const normalizeOtp = (value) =>
  typeof value === "number" ? String(value) : value;

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  if (
    typeof req.body.email !== "string" ||
    typeof req.body.phone !== "string"
  ) {
    return next(new AppError("يرجى إدخال البريد الإلكتروني ورقم الهاتف", 400));
  }

  const existingUser = await User.findOne({
    $or: [{ email: req.body.email }, { phone: req.body.phone }],
  });

  if (existingUser) {
    if (existingUser.verified) {
      return next(
        new AppError("هذا البريد أو الرقم مستخدم بالفعل ومفعل.", 400),
      );
    } else {
      await User.findByIdAndDelete(existingUser._id);
    }
  }
  // التسجيل الذاتي كـ owner مقفول افتراضياً: أي حد كان يقدر يبعت role: "owner"
  // ويعمل نوادي ويحجز بصلاحيات مالك. الملاك بيتعملوا من لوحة الأدمن (POST /admin/owners).
  // لو محتاج التسجيل كمالك مفتوح، حط ALLOW_OWNER_SIGNUP=true في .env
  const allowOwnerSignup = process.env.ALLOW_OWNER_SIGNUP === "true";
  const userRole =
    allowOwnerSignup && req.body.role === "owner" ? "owner" : "customer";

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: userRole,
    verified: false,
  });

  const otp = generateOTP();
  newUser.otp = otp;
  newUser.otpExpires = Date.now() + OTP_TTL_MS;

  await newUser.save({ validateBeforeSave: false });
  clearOtpFailures(`verify:${newUser.email.toLowerCase()}`);

  try {
    await new Email(newUser, "").sendOTP(otp);
    res.status(200).json({
      status: "success",
      message: "OTP sent to email",
      email: newUser.email,
    });
  } catch (err) {
    console.error("خطأ أثناء إرسال إيميل التسجيل (signup):", err);
    newUser.otp = undefined;
    newUser.otpExpires = undefined;
    await newUser.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Try again later!",
        500,
      ),
    );
  }
});

exports.verifyOTP = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const otp = normalizeOtp(req.body.otp);

  if (typeof email !== "string" || typeof otp !== "string") {
    return next(new AppError("يرجى إدخال البريد الإلكتروني ورمز التحقق", 400));
  }

  const lockKey = `verify:${email.toLowerCase()}`;
  if (isOtpLocked(lockKey)) {
    return next(
      new AppError(
        "محاولات خاطئة كثيرة، اطلب رمزاً جديداً أو حاول بعد 15 دقيقة",
        429,
      ),
    );
  }

  const user = await User.findOne({
    email,
    otp,
    otpExpires: { $gt: Date.now() },
  });

  if (!user) {
    registerOtpFailure(lockKey);
    return next(new AppError("رمز التحقق غير صالح أو قد انتهت صلاحيته!", 400));
  }
  clearOtpFailures(lockKey);

  user.verified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  // فشل إيميل الترحيب ماينفعش يمنع المستخدم من الدخول (الكود اتمسح خلاص ومش هيقدر يعيد)
  try {
    const url = `${process.env.FRONTEND_URL}/explore`;
    await new Email(user, url).sendWelcome();
  } catch (err) {
    console.error("خطأ أثناء إرسال إيميل الترحيب:", err);
  }

  createAndSendToken(user, 200, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { phone, password } = req.body;

  if (
    typeof phone !== "string" ||
    typeof password !== "string" ||
    !phone ||
    !password
  ) {
    return next(new AppError("يرجى تقديم رقم الهاتف وكلمة المرور", 400));
  }

  const user = await User.findOne({ phone }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("رقم الهاتف أو كلمة المرور غير صحيحة", 401));
  }

  if (!user.verified) {
    return res.status(403).json({
      status: "fail",
      message: "حسابك غير مفعل، يرجى إدخال كود التحقق.",
      actionRequired: "VERIFY_OTP",
      email: user.email,
    });
  }

  createAndSendToken(user, 200, res);
});

exports.resendOTP = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return next(new AppError("يرجى توفير البريد الإلكتروني", 400));
  }

  // نفس الرد في كل الحالات (مسجل / مش مسجل / مفعل / فترة انتظار)
  // عشان محدش يعرف مين عنده حساب على التطبيق
  const respond = () =>
    res.status(200).json({
      status: "success",
      message:
        "إذا كان البريد مسجلاً وغير مفعل، فقد تم إرسال كود تحقق جديد إليه",
      email,
    });

  const user = await User.findOne({ email });

  if (!user || user.verified) return respond();
  if (issuedRecently(user.otpExpires)) return respond();

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = Date.now() + OTP_TTL_MS;
  await user.save({ validateBeforeSave: false });
  clearOtpFailures(`verify:${email.toLowerCase()}`);

  try {
    await new Email(user, "").sendOTP(otp);
    return respond();
  } catch (err) {
    console.error("خطأ أثناء إرسال إيميل إعادة الإرسال (resendOTP):", err);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "حدث خطأ أثناء إرسال البريد الإلكتروني، يرجى المحاولة لاحقاً",
        500,
      ),
    );
  }
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token || token === "loggedout") {
    return next(
      new AppError("أنت غير مسجل الدخول! يرجى تسجيل الدخول للوصول.", 401),
    );
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError("المستخدم صاحب هذا التوكن لم يعد موجوداً", 401));
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "تم تغيير كلمة المرور مؤخراً. الرجاء تسجيل الدخول مجدداً.",
        401,
      ),
    );
  }

  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

exports.isLoggedIn = catchAsync(async (req, res, next) => {
  if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
    try {
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );
      const currentUser = await User.findById(decoded.id);

      if (!currentUser || currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      res.locals.user = currentUser;
      req.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
});

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: "success" });
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError("You are not logged in to access this feature.", 401),
      );
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError("ليس لديك الصلاحية للقيام بهذا الإجراء", 403));
    }
    next();
  };
};

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("كلمة مرورك الحالية غير صحيحة", 401));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  createAndSendToken(user, 200, res);
});

exports.forgetPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return next(new AppError("يرجى توفير البريد الإلكتروني", 400));
  }

  // نفس الرد سواء الإيميل مسجل أو لأ (منع تخمين الإيميلات المسجلة)
  const respond = () =>
    res.status(200).json({
      status: "success",
      message: "إذا كان البريد مسجلاً، فقد تم إرسال رمز إعادة التعيين إليه",
      email,
    });

  const user = await User.findOne({ email });
  if (!user) return respond();

  // فترة انتظار بين كل إرسال: بتمنع إغراق صاحب الإيميل برسائل
  if (issuedRecently(user.passwordResetOTPExpires)) return respond();

  const otp = generateOTP();
  user.passwordResetOTP = otp;
  user.passwordResetOTPExpires = Date.now() + OTP_TTL_MS;
  await user.save({ validateBeforeSave: false });
  clearOtpFailures(`reset:${email.toLowerCase()}`);

  // نرجع رد للمستخدم فورًا من غير ما ننتظر إرسال الإيميل يخلص
  respond();

  // إرسال الإيميل يحصل في الخلفية - لو فشل، بنسجل الخطأ الحقيقي في الكونسول
  // من غير ما نأثر على رد المستخدم اللي وصله بالفعل
  try {
    await new Email(user, "").sendPasswordResetOTP(otp);
  } catch (err) {
    console.error("خطأ أثناء إرسال إيميل إعادة تعيين كلمة المرور:", err);
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { email, password, passwordConfirm } = req.body;
  const otp = normalizeOtp(req.body.otp);

  if (
    typeof email !== "string" ||
    typeof otp !== "string" ||
    typeof password !== "string" ||
    typeof passwordConfirm !== "string"
  ) {
    return next(new AppError("يرجى إدخال جميع البيانات المطلوبة", 400));
  }

  const lockKey = `reset:${email.toLowerCase()}`;
  if (isOtpLocked(lockKey)) {
    return next(
      new AppError(
        "محاولات خاطئة كثيرة، اطلب رمزاً جديداً أو حاول بعد 15 دقيقة",
        429,
      ),
    );
  }

  const user = await User.findOne({
    email,
    passwordResetOTP: otp,
    passwordResetOTPExpires: { $gt: Date.now() },
  });

  if (!user) {
    registerOtpFailure(lockKey);
    return next(new AppError("رمز التحقق غير صالح أو منتهي الصلاحية", 400));
  }
  clearOtpFailures(lockKey);

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpires = undefined;
  await user.save();

  createAndSendToken(user, 200, res);
});

exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.jwt && req.cookies.jwt !== "loggedout") {
      token = req.cookies.jwt;
    }

    if (!token) return next();

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);

    if (!currentUser || currentUser.changedPasswordAfter(decoded.iat))
      return next();

    req.user = currentUser;
    res.locals.user = currentUser;
    return next();
  } catch (err) {
    return next();
  }
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) منع المستخدم من تحديث كلمة المرور من هذا المسار
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "هذا المسار مخصص لتحديث البيانات الشخصية فقط، وليس كلمة المرور.",
        400,
      ),
    );
  }

  const filteredBody = {
    name: req.body.name,
    email: req.body.email,
    // phone: req.body.phone,
  };

  // 3) تحديث بيانات المستخدم في الداتا بيز
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  // استخدام الحقل الصحيح isActive لتعطيل الحساب
  await User.findByIdAndUpdate(req.user.id, { isActive: false });

  // مسح التوكن وتسجيل خروجه
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(204).json({
    status: "success",
    data: null,
  });
});
