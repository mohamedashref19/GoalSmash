const Review = require("../models/reviewModel");
const Booking = require("../models/bookingModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.createReview = catchAsync(async (req, res, next) => {
  const venueId = req.params.venueId || req.body.venue;
  const userId = req.user.id;

  // 1. التأكد من أن المستخدم قام بحجز مؤكد في هذا النادي، وأن وقت الحجز قد مر
  const hasBooked = await Booking.findOne({
    user: userId,
    venue: venueId,
    status: "confirmed",
    startTime: { $lt: new Date() },
  });

  if (!hasBooked) {
    return next(
      new AppError(
        "عذراً، يجب أن تقوم بتجربة وحجز هذا الملعب أولاً لتتمكن من تقييمه.",
        403,
      ),
    );
  }

  // 2. إنشاء التقييم
  const newReview = await Review.create({
    review: req.body.review,
    rating: req.body.rating,
    venue: venueId,
    user: userId,
  });

  res.status(201).json({
    status: "success",
    data: { review: newReview },
  });
});

exports.getVenueReviews = catchAsync(async (req, res, next) => {
  let filter = {};
  if (req.params.venueId) filter = { venue: req.params.venueId };

  const reviews = await Review.find(filter).populate({
    path: "user",
    select: "name",
  });

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: { reviews },
  });
});

// +++ إضافة: دالة تعديل التقييم للعميل +++
exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError("لم يتم العثور على التقييم", 404));
  }

  // السماح للمستخدم بتعديل تقييمه الخاص فقط
  if (review.user.toString() !== req.user.id) {
    return next(new AppError("غير مصرح لك بتعديل هذا التقييم", 403));
  }

  const updatedReview = await Review.findByIdAndUpdate(
    req.params.id,
    { review: req.body.review, rating: req.body.rating },
    {
      new: true,
      runValidators: true,
    },
  );

  // إجبار إعادة حساب المتوسط بعد التعديل باستخدام save() وهمية لتشغيل الـ middleware أو تشغيله يدوياً
  await Review.calcAverageRatings(updatedReview.venue);

  res.status(200).json({
    status: "success",
    data: {
      review: updatedReview,
    },
  });
});

// +++ إضافة: دالة حذف التقييم (لصاحب التقييم، الأدمن، أو مالك النادي) +++
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate("venue");

  if (!review) {
    return next(new AppError("لم يتم العثور على التقييم", 404));
  }

  // التحقق من الصلاحيات:
  // 1. الأدمن
  // 2. صاحب التقييم نفسه
  // 3. مالك النادي الذي يحتوي على هذا التقييم
  const isOwnerOfReview = review.user.toString() === req.user.id;
  const isAdmin = req.user.role === "admin";
  const isVenueOwner =
    req.user.role === "owner" &&
    review.venue.owner &&
    review.venue.owner.toString() === req.user.id;

  if (!isOwnerOfReview && !isAdmin && !isVenueOwner) {
    return next(new AppError("غير مصرح لك بحذف هذا التقييم", 403));
  }

  // استخدام findByIdAndDelete بدلاً من deleteOne لتسهيل إرجاع الوثيقة المحذوفة لو لزم الأمر
  await Review.findByIdAndDelete(req.params.id);

  // إعادة حساب متوسط التقييمات للنادي بعد الحذف
  if (review.venue) {
    await Review.calcAverageRatings(review.venue._id);
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});
