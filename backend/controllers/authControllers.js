const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Email = require("../utils/email");

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
  const allowedRoles = ["customer", "owner"];
  const userRole = allowedRoles.includes(req.body.role)
    ? req.body.role
    : "customer";

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: userRole,
    verified: false,
  });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  newUser.otp = otp;
  newUser.otpExpires = Date.now() + 10 * 60 * 1000;

  await newUser.save({ validateBeforeSave: false });

  try {
    await new Email(newUser, "").sendOTP(otp);
    res.status(200).json({
      status: "success",
      message: "OTP sent to email",
      email: newUser.email,
    });
  } catch (err) {
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
  const { email, otp } = req.body;
  const user = await User.findOne({
    email,
    otp,
    otpExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("رمز التحقق غير صالح أو قد انتهت صلاحيته!", 400));
  }

  user.verified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  const url = `${process.env.FRONTEND_URL}/explore`;
  await new Email(user, url).sendWelcome();

  createAndSendToken(user, 200, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
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

  if (!email) {
    return next(new AppError("يرجى توفير البريد الإلكتروني", 400));
  }

  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError("لا يوجد مستخدم بهذا البريد الإلكتروني", 404));
  }

  if (user.verified) {
    return res.status(400).json({
      status: "fail",
      message: "هذا الحساب مفعل بالفعل، يمكنك تسجيل الدخول.",
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.otp = otp;
  user.otpExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  try {
    await new Email(user, "").sendOTP(otp);
    res.status(200).json({
      status: "success",
      message: "تم إرسال كود تحقق جديد إلى بريدك الإلكتروني",
      email: user.email,
    });
  } catch (err) {
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
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("عنوان البريد الإلكتروني المُدخل غير مسجل.", 404));
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.passwordResetOTP = otp;
  user.passwordResetOTPExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  // نرجع رد للمستخدم فورًا من غير ما ننتظر إرسال الإيميل يخلص
  res.status(200).json({
    status: "success",
    message: "OTP sent to your email",
    email: user.email,
  });

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
  const { email, otp, password, passwordConfirm } = req.body;

  const user = await User.findOne({
    email,
    passwordResetOTP: otp,
    passwordResetOTPExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("رمز التحقق غير صالح أو منتهي الصلاحية", 400));
  }

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
