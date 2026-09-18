const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Court = require("../models/courtModel");
const Venue = require("../models/venueModel"); // +++ استدعاء موديل المكان +++
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getTodayStats = catchAsync(async (req, res, next) => {
  const venueId = req.query.venue;
  if (!venueId) {
    return next(new AppError("يرجى تحديد المكان (venue)", 400));
  }

  // +++ قفل الأمان: التأكد إن المالك ده هو صاحب الملعب فعلاً +++
  if (req.user && req.user.role === "owner") {
    const venueCheck = await Venue.findOne({
      _id: venueId,
      owner: req.user.id,
    });
    if (!venueCheck) {
      return next(
        new AppError("غير مصرح لك بالوصول لإحصائيات هذا الملعب!", 403),
      );
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayStats = await Booking.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(venueId),
        startTime: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalPrice" },
        bookingsCount: { $sum: 1 },
      },
    },
  ]);

  const stats = todayStats[0] || { totalRevenue: 0, bookingsCount: 0 };

  const courtsCount = await Court.countDocuments({
    venue: venueId,
    status: "active",
  });
  const totalAvailableHours = courtsCount * 10;
  const bookedHours = stats.bookingsCount * 1.5;
  const occupancyRate =
    totalAvailableHours === 0
      ? 0
      : Math.round((bookedHours / totalAvailableHours) * 100);

  res.status(200).json({
    status: "success",
    data: {
      todayRevenue: stats.totalRevenue,
      todayBookings: stats.bookingsCount,
      occupancyRate: `${occupancyRate}%`,
      activeCourts: courtsCount,
    },
  });
});

exports.getTopCustomers = catchAsync(async (req, res, next) => {
  const venueId = req.query.venue;
  if (!venueId) {
    return next(new AppError("يرجى تحديد المكان (venue)", 400));
  }

  // +++ قفل الأمان: التأكد إن المالك ده هو صاحب الملعب فعلاً +++
  if (req.user && req.user.role === "owner") {
    const venueCheck = await Venue.findOne({
      _id: venueId,
      owner: req.user.id,
    });
    if (!venueCheck) {
      return next(new AppError("غير مصرح لك بالوصول لبيانات هذا الملعب!", 403));
    }
  }

  const topCustomers = await Booking.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(venueId),
        status: { $ne: "cancelled" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userData",
      },
    },
    {
      $unwind: {
        path: "$userData",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        totalPrice: 1,
        customerPhone: { $ifNull: ["$guestData.phone", "$userData.phone"] },
        customerName: { $ifNull: ["$guestData.name", "$userData.name"] },
      },
    },
    {
      $group: {
        _id: "$customerPhone",
        name: { $first: "$customerName" },
        phone: { $first: "$customerPhone" },
        totalBookings: { $sum: 1 },
        totalSpent: { $sum: "$totalPrice" },
      },
    },
    {
      $sort: { totalBookings: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  res.status(200).json({
    status: "success",
    results: topCustomers.length,
    data: {
      topCustomers,
    },
  });
});
