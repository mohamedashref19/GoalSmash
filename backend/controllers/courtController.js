const mongoose = require("mongoose");
const Court = require("../models/courtModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// نفس فكرة venueController: الحقول المسموحة بس
const COURT_FIELDS = [
  "name",
  "sportType",
  "status",
  "priceMorning",
  "priceEvening",
];

const pick = (obj, fields) =>
  fields.reduce((acc, f) => {
    if (obj[f] !== undefined) acc[f] = obj[f];
    return acc;
  }, {});

// courtModel بيعمل populate للـ venue، فنجيب الـ id بالطريقة دي
const idOf = (v) => ((v && v._id) || v)?.toString();

// حماية داخل الكنترولر حتى لو الـ route مفيهوش restrictTo
const ensureCanManage = (req, next) => {
  if (!["owner", "admin"].includes(req.user?.role)) {
    next(new AppError("ليس لديك الصلاحية للقيام بهذا الإجراء", 403));
    return false;
  }
  return true;
};

exports.createCourt = catchAsync(async (req, res, next) => {
  if (!ensureCanManage(req, next)) return;

  const venueId = req.body.venue;

  if (!venueId) {
    return next(
      new AppError(
        "يرجى تحديد المكان (venue) الذي سيتم إضافة الملعب إليه",
        400,
      ),
    );
  }
  if (typeof venueId !== "string" || !mongoose.isValidObjectId(venueId)) {
    return next(new AppError("معرف المكان غير صالح", 400));
  }

  const venue = await Venue.findById(venueId);
  if (!venue) {
    return next(new AppError("لا يوجد مكان بهذا المعرف", 404));
  }

  if (req.user.role === "owner" && venue.owner.toString() !== req.user.id) {
    return next(new AppError("ليس لديك صلاحية لإضافة ملعب في هذا المكان", 403));
  }

  const data = { ...pick(req.body, COURT_FIELDS), venue: venue._id };

  if (req.file) {
    data.image = req.file.path;
  }

  const newCourt = await Court.create(data);

  res.status(201).json({
    status: "success",
    data: {
      court: newCourt,
    },
  });
});

exports.getAllCourts = catchAsync(async (req, res, next) => {
  let filter = {};
  if (req.query.venue) {
    if (
      typeof req.query.venue !== "string" ||
      !mongoose.isValidObjectId(req.query.venue)
    ) {
      return next(new AppError("معرف المكان غير صالح", 400));
    }
    filter = { venue: req.query.venue };
  }

  const courts = await Court.find(filter);

  res.status(200).json({
    status: "success",
    results: courts.length,
    data: {
      courts,
    },
  });
});

exports.updateCourt = catchAsync(async (req, res, next) => {
  if (!ensureCanManage(req, next)) return;

  let court = await Court.findById(req.params.id);

  if (!court) {
    return next(new AppError("لا يوجد ملعب بهذا المعرف", 404));
  }

  const venue = await Venue.findById(idOf(court.venue));

  // المالك لازم يكون صاحب النادي فعلاً. الشرط القديم (venue && ...) كان بيعدّي أي مالك
  // لو النادي اتعطّل أو اتمسح.
  if (
    req.user.role === "owner" &&
    (!venue || venue.owner.toString() !== req.user.id)
  ) {
    return next(new AppError("ليس لديك صلاحية لتعديل بيانات هذا الملعب", 403));
  }

  const data = pick(req.body, COURT_FIELDS);

  if (req.file) {
    data.image = req.file.path;
  }

  court = await Court.findByIdAndUpdate(req.params.id, data, {
    returnDocument: "after",
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      court,
    },
  });
});
