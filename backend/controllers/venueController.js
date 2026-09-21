const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.createVenue = catchAsync(async (req, res, next) => {
  if (!req.body.owner) req.body.owner = req.user.id;

  if (req.file) {
    // Cloudinary بيرجع الرابط الدائم للصورة في req.file.path
    req.body.image = req.file.path;
  }

  const newVenue = await Venue.create(req.body);

  res.status(201).json({
    status: "success",
    data: {
      venue: newVenue,
    },
  });
});

exports.getAllVenues = catchAsync(async (req, res, next) => {
  let filter = {};

  if (req.user.role === "owner") {
    filter = { owner: req.user.id };
  }

  const venues = await Venue.find(filter)
    .populate("courts")
    .populate("owner", "name phone email");

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

  if (req.user.role === "owner" && venue.owner.toString() !== req.user.id) {
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

  if (req.file) {
    // Cloudinary بيرجع الرابط الدائم للصورة في req.file.path
    req.body.image = req.file.path;
  }

  venue = await Venue.findByIdAndUpdate(req.params.id, req.body, {
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
