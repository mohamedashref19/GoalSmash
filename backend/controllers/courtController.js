const Court = require("../models/courtModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.createCourt = catchAsync(async (req, res, next) => {
  const venueId = req.body.venue;

  if (!venueId) {
    return next(
      new AppError(
        "يرجى تحديد المكان (venue) الذي سيتم إضافة الملعب إليه",
        400,
      ),
    );
  }

  const venue = await Venue.findById(venueId);
  if (!venue) {
    return next(new AppError("لا يوجد مكان بهذا المعرف", 404));
  }

  if (req.user.role === "owner" && venue.owner.toString() !== req.user.id) {
    return next(new AppError("ليس لديك صلاحية لإضافة ملعب في هذا المكان", 403));
  }

  if (req.file) {
    // Cloudinary بيرجع الرابط الدائم للصورة في req.file.path
    req.body.image = req.file.path;
  }

  const newCourt = await Court.create(req.body);

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
  let court = await Court.findById(req.params.id);

  if (!court) {
    return next(new AppError("لا يوجد ملعب بهذا المعرف", 404));
  }

  const venue = await Venue.findById(court.venue);

  if (
    req.user.role === "owner" &&
    venue &&
    venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("ليس لديك صلاحية لتعديل بيانات هذا الملعب", 403));
  }

  if (req.body.venue) delete req.body.venue;

  if (req.file) {
    // Cloudinary بيرجع الرابط الدائم للصورة في req.file.path
    req.body.image = req.file.path;
  }

  court = await Court.findByIdAndUpdate(req.params.id, req.body, {
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
