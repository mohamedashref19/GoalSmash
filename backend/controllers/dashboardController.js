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

  const venueDoc = await Venue.findById(venueId);
  if (!venueDoc) {
    return next(new AppError("هذا الملعب غير موجود", 404));
  }

  if (
    req.user &&
    req.user.role === "owner" &&
    venueDoc.owner.toString() !== req.user.id
  ) {
    return next(new AppError("غير مصرح لك بالوصول لإحصائيات هذا الملعب!", 403));
  }

  const now = new Date();
  const cairoTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }),
  );
  const utcTime = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const dynamicEgyptOffset = (cairoTime - utcTime) / (1000 * 60 * 60);

  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0 - dynamicEgyptOffset, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23 - dynamicEgyptOffset, 59, 59, 999);

  const todayStats = await Booking.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(venueId),
        startTime: { $gte: startOfDay, $lte: endOfDay },
        status: "confirmed", // احتساب المؤكد فقط
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalPrice" },
        bookingsCount: { $sum: 1 },
        totalBookedHours: {
          $sum: {
            $divide: [
              { $subtract: ["$endTime", "$startTime"] },
              1000 * 60 * 60,
            ],
          },
        },
      },
    },
  ]);

  const stats = todayStats[0] || {
    totalRevenue: 0,
    bookingsCount: 0,
    totalBookedHours: 0,
  };

  const activeCourtsCount = await Court.countDocuments({
    venue: venueId,
    status: "active",
  });

  // +++ الحسبة الديناميكية لنسبة الإشغال +++
  const dailyOperatingHours = venueDoc.operatingHours || 24;
  const totalAvailableHours = activeCourtsCount * dailyOperatingHours;

  const occupancyRate =
    totalAvailableHours === 0
      ? 0
      : Math.round((stats.totalBookedHours / totalAvailableHours) * 100);

  res.status(200).json({
    status: "success",
    data: {
      todayRevenue: stats.totalRevenue,
      todayBookings: stats.bookingsCount,
      occupancyRate: `${Math.min(occupancyRate, 100)}%`,
      activeCourts: activeCourtsCount,
    },
  });
});

exports.getTopCustomers = catchAsync(async (req, res, next) => {
  const venueId = req.query.venue;
  if (!venueId) {
    return next(new AppError("يرجى تحديد المكان (venue)", 400));
  }

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
        // +++ تعديل: جلب الحجوزات المؤكدة فقط لضمان دقة إجمالي الإنفاق للعميل +++
        status: "confirmed",
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
