const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// الحقول المسموح بتعديلها. قبل كده الـ req.body كان بيتبعت للداتابيز كما هو (mass assignment):
// المالك كان يقدر يبعت owner لحساب تاني أو isActive.
const VENUE_FIELDS = [
  "name",
  "phone",
  "openTime",
  "closeTime",
  "operatingHours",
  "eveningStartTime",
  "workingDays",
  "address",
];

const pick = (obj, fields) =>
  fields.reduce((acc, f) => {
    if (obj[f] !== undefined) acc[f] = obj[f];
    return acc;
  }, {});

exports.createVenue = catchAsync(async (req, res, next) => {
  const data = pick(req.body, VENUE_FIELDS);

  // الأدمن بس يقدر يحدد مالك تاني، المالك دايماً هو نفسه
  data.owner =
    req.user.role === "admin" && req.body.owner ? req.body.owner : req.user.id;

  // الصورة بتيجي من الرفع بس (رابط R2 اللي بيطلع من uploadMiddleware)
  if (req.file) {
    data.image = req.file.path;
  }

  const newVenue = await Venue.create(data);

  res.status(201).json({
    status: "success",
    data: {
      venue: newVenue,
    },
  });
});

exports.getAllVenues = catchAsync(async (req, res, next) => {
  let filter = {};

  // +++ تم التعديل: التأكد من وجود req.user قبل قراءة role لحماية المسارات العامة +++
  if (req.user && req.user.role === "owner") {
    filter = { owner: req.user.id };
  } else if (req.user && req.user.role === "employee") {
    filter = { _id: req.user.venue }; // الموظف يشوف النادي بتاعه بس
  }

  let query = Venue.find(filter).populate("courts");

  // بيانات المالك (إيميل ورقم) للأدمن والمالك نفسه بس.
  // قبل كده كل عميل كان بيشوف إيميل ورقم كل مالك في المنصة.
  if (req.user && ["admin", "owner"].includes(req.user.role)) {
    query = query.populate("owner", "name phone email");
  }

  const venues = await query;

  res.status(200).json({
    status: "success",
    results: venues.length,
    data: {
      venues,
    },
  });
});

exports.getVenue = catchAsync(async (req, res, next) => {
  const venue = await Venue.findById(req.params.id).populate("courts");

  if (!venue) {
    return next(new AppError("لا يوجد مكان بهذا المعرف", 404));
  }

  // +++ تم التعديل: التأكد من وجود req.user +++
  if (
    req.user &&
    req.user.role === "owner" &&
    venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("ليس لديك صلاحية لعرض تفاصيل هذا المكان", 403));
  }

  res.status(200).json({
    status: "success",
    data: {
      venue,
    },
  });
});

exports.updateVenue = catchAsync(async (req, res, next) => {
  let venue = await Venue.findById(req.params.id);

  if (!venue) {
    return next(new AppError("لا يوجد مكان بهذا المعرف", 404));
  }

  if (req.user.role === "owner" && venue.owner.toString() !== req.user.id) {
    return next(new AppError("ليس لديك صلاحية لتعديل بيانات هذا المكان", 403));
  }

  const data = pick(req.body, VENUE_FIELDS);

  // نقل الملكية وتفعيل/إيقاف النادي للأدمن فقط
  if (req.user.role === "admin") {
    if (req.body.owner) data.owner = req.body.owner;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
  }

  if (req.file) {
    data.image = req.file.path;
  }

  venue = await Venue.findByIdAndUpdate(req.params.id, data, {
    returnDocument: "after",
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      venue,
    },
  });
});
