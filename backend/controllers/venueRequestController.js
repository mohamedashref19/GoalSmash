const VenueRequest = require("../models/venueRequestModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// 1. إرسال طلب إضافة ملعب جديد (متاح لأي مستخدم مسجل دخول)
exports.createVenueRequest = catchAsync(async (req, res, next) => {
  const { venueName, area, venuePhone, requesterRole, notes } = req.body;

  if (!venueName || !area) {
    return next(new AppError("يرجى إدخال اسم الملعب والمنطقة على الأقل", 400));
  }

  const newRequest = await VenueRequest.create({
    venueName,
    area,
    venuePhone: venuePhone || "",
    requesterRole: requesterRole === "owner" ? "owner" : "player",
    notes: notes || "",
    submittedBy: req.user?._id,
    submitterName: req.user?.name || "مستخدم",
    submitterPhone: req.user?.phone || "",
  });

  res.status(201).json({
    status: "success",
    data: {
      request: newRequest,
    },
  });
});

// 2. جلب جميع طلبات إضافة الملاعب (للأدمن فقط)
exports.getAllVenueRequests = catchAsync(async (req, res, next) => {
  const requests = await VenueRequest.find().sort("-createdAt");

  res.status(200).json({
    status: "success",
    results: requests.length,
    data: {
      requests,
    },
  });
});

// 3. تحديث حالة الطلب (جديد / تم التواصل / تمت الإضافة)
exports.updateVenueRequestStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!["pending", "contacted", "added"].includes(status)) {
    return next(new AppError("حالة الطلب غير صالحة", 400));
  }

  const request = await VenueRequest.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true },
  );

  if (!request) {
    return next(new AppError("لا يوجد طلب بهذا المعرف", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      request,
    },
  });
});

// 4. حذف طلب إضافة ملعب (للأدمن فقط)
exports.deleteVenueRequest = catchAsync(async (req, res, next) => {
  const request = await VenueRequest.findByIdAndDelete(req.params.id);

  if (!request) {
    return next(new AppError("لا يوجد طلب بهذا المعرف", 404));
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
