const mongoose = require("mongoose");
const Court = require("../models/courtModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

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

const idOf = (v) => ((v && v._id) || v)?.toString();

const ensureCanManage = (req, next) => {
  if (!["owner", "admin", "employee"].includes(req.user?.role)) {
    next(new AppError("ليس لديك الصلاحية للقيام بهذا الإجراء", 403));
    return false;
  }
  return true;
};

// دالة مساعدة لقراءة الصور القديمة التي أبقى عليها المستخدم أثناء التعديل
const parseExistingImages = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.filter((u) => typeof u === "string" && u.startsWith("http"));
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (u) => typeof u === "string" && u.startsWith("http"),
        );
      }
    } catch {
      if (raw.startsWith("http")) return [raw];
    }
  }
  return null;
};

exports.createCourt = catchAsync(async (req, res, next) => {
  if (!["owner", "admin"].includes(req.user?.role)) {
    return next(new AppError("ليس لديك الصلاحية لإضافة ملعب جديد", 403));
  }

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

  if (req.uploadedCourtImages && req.uploadedCourtImages.length > 0) {
    data.images = req.uploadedCourtImages;
    data.image = req.uploadedCourtImages[0]; // الصورة الأولى هي الغلاف الأساسي
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

  if (
    req.user.role === "owner" &&
    (!venue || venue.owner.toString() !== req.user.id)
  ) {
    return next(new AppError("ليس لديك صلاحية لتعديل بيانات هذا الملعب", 403));
  }

  if (
    req.user.role === "employee" &&
    (!venue ||
      !req.user.venue ||
      req.user.venue.toString() !== venue._id.toString())
  ) {
    return next(new AppError("ليس لديك صلاحية لتعديل بيانات هذا الملعب", 403));
  }

  const data = pick(req.body, COURT_FIELDS);

  const keptImages = parseExistingImages(req.body.existingImages);
  const newUploads = req.uploadedCourtImages || [];

  // إذا أرسل الفرونت إند قائمة صور قديمة محتفظ بها أو رفع صوراً جديدة
  if (keptImages !== null || newUploads.length > 0) {
    const baseList = keptImages !== null ? keptImages : [];
    const mergedImages = [...baseList, ...newUploads].slice(0, 5);

    data.images = mergedImages;
    if (mergedImages.length > 0) {
      data.image = mergedImages[0];
    } else {
      data.image = "https://mla3balexandria-api.online/assets/logo.png";
    }
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
