const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Venue = require("../models/venueModel");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// 1. نظرة عامة على التطبيق (للسوبر أدمن)
exports.getPlatformOverview = catchAsync(async (req, res, next) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const platformStats = await Booking.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    {
      $project: {
        totalPrice: 1,
        bookingType: 1,
        startTime: 1,
        // +++ حساب مدة الحجز بالساعات +++
        durationInHours: {
          $divide: [
            { $subtract: ["$endTime", "$startTime"] },
            1000 * 60 * 60, // تحويل الميلي ثانية إلى ساعات
          ],
        },
        isAppBooking: { $cond: [{ $eq: ["$bookingType", "app"] }, 1, 0] },
        isManualBooking: { $cond: [{ $eq: ["$bookingType", "manual"] }, 1, 0] },
        isToday: { $gte: ["$startTime", startOfDay] },
      },
    },
    {
      $project: {
        totalPrice: 1,
        bookingType: 1,
        startTime: 1,
        isAppBooking: 1,
        isManualBooking: 1,
        isToday: 1,
        // +++ حساب العمولة ديناميكياً: 10% لو مدة الحجز >= 2 ساعة، 5% لغير ذلك +++
        commission: {
          $multiply: [
            "$totalPrice",
            { $cond: [{ $gte: ["$durationInHours", 2] }, 0.1, 0.05] },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalPlatformRevenue: { $sum: "$totalPrice" },
        totalCommissionEarned: { $sum: "$commission" },
        totalBookings: { $sum: 1 },
        appBookingsCount: { $sum: "$isAppBooking" },
        manualBookingsCount: { $sum: "$isManualBooking" },
        todayBookings: { $sum: { $cond: ["$isToday", 1, 0] } },
        todayCommission: { $sum: { $cond: ["$isToday", "$commission", 0] } },
      },
    },
  ]);

  const stats = platformStats[0] || {
    totalPlatformRevenue: 0,
    totalCommissionEarned: 0,
    totalBookings: 0,
    appBookingsCount: 0,
    manualBookingsCount: 0,
    todayBookings: 0,
    todayCommission: 0,
  };

  const totalVenues = await Venue.countDocuments({ isActive: true });
  const totalUsers = await User.countDocuments({ role: "customer" });
  const totalOwners = await User.countDocuments({ role: "owner" });

  res.status(200).json({
    status: "success",
    data: {
      financials: {
        totalPlatformRevenue: stats.totalPlatformRevenue,
        totalCommissionEarned: stats.totalCommissionEarned,
        todayCommission: stats.todayCommission,
      },
      bookings: {
        total: stats.totalBookings,
        appBookings: stats.appBookingsCount,
        manualBookings: stats.manualBookingsCount,
        today: stats.todayBookings,
      },
      entities: {
        activeVenues: totalVenues,
        customers: totalUsers,
        owners: totalOwners,
      },
    },
  });
});

// 2. أداء الأندية والملاعب
exports.getVenuesPerformance = catchAsync(async (req, res, next) => {
  const venuesPerformance = await Booking.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    {
      $project: {
        venue: 1,
        court: 1,
        totalPrice: 1,
        bookingType: 1,
        // +++ حساب مدة الحجز بالساعات +++
        durationInHours: {
          $divide: [{ $subtract: ["$endTime", "$startTime"] }, 1000 * 60 * 60],
        },
      },
    },
    {
      $project: {
        venue: 1,
        court: 1,
        totalPrice: 1,
        bookingType: 1,
        // +++ حساب العمولة ديناميكياً بناءً على مدة الحجز +++
        calculatedCommission: {
          $multiply: [
            "$totalPrice",
            { $cond: [{ $gte: ["$durationInHours", 2] }, 0.1, 0.05] },
          ],
        },
      },
    },
    {
      $group: {
        _id: { venue: "$venue", court: "$court" },
        courtTotalBookings: { $sum: 1 },
        courtTotalRevenue: { $sum: "$totalPrice" },
        courtAppBookings: {
          $sum: { $cond: [{ $eq: ["$bookingType", "app"] }, 1, 0] },
        },
        courtManualBookings: {
          $sum: { $cond: [{ $eq: ["$bookingType", "manual"] }, 1, 0] },
        },
        courtCommission: {
          $sum: "$calculatedCommission", // استخدام العمولة المحسوبة مسبقاً
        },
      },
    },
    {
      $lookup: {
        from: "courts",
        localField: "_id.court",
        foreignField: "_id",
        as: "courtDetails",
      },
    },
    { $unwind: { path: "$courtDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$_id.venue",
        totalBookings: { $sum: "$courtTotalBookings" },
        totalRevenue: { $sum: "$courtTotalRevenue" },
        appBookingsCount: { $sum: "$courtAppBookings" },
        manualBookingsCount: { $sum: "$courtManualBookings" },
        commissionOwedToPlatform: { $sum: "$courtCommission" },
        courtsBreakdown: {
          $push: {
            courtId: "$_id.court",
            name: "$courtDetails.name",
            sportType: "$courtDetails.sportType",
            bookingsCount: "$courtTotalBookings",
            revenue: "$courtTotalRevenue",
            commissionGenerated: "$courtCommission",
          },
        },
      },
    },
    {
      $lookup: {
        from: "venues",
        localField: "_id",
        foreignField: "_id",
        as: "venueDetails",
      },
    },
    { $unwind: "$venueDetails" },
    {
      $project: {
        venueName: "$venueDetails.name",
        city: "$venueDetails.address.city",
        totalBookings: 1,
        totalRevenue: 1,
        appBookingsCount: 1,
        manualBookingsCount: 1,
        commissionOwedToPlatform: 1,
        courtsBreakdown: 1,
      },
    },
    { $sort: { commissionOwedToPlatform: -1 } },
  ]);

  res.status(200).json({
    status: "success",
    results: venuesPerformance.length,
    data: { venuesPerformance },
  });
});

// +++ 3. دالة جديدة: إنشاء مالك جديد مباشرة (للسوبر أدمن) +++
exports.createOwner = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, passwordConfirm } = req.body;

  const newOwner = await User.create({
    name,
    email,
    phone,
    password,
    passwordConfirm,
    role: "owner",
    verified: true, // الحساب مفعل تلقائياً لأنه مضاف من الإدارة
  });

  // إخفاء الباسورد من النتيجة
  newOwner.password = undefined;

  res.status(201).json({
    status: "success",
    message: "تم إنشاء حساب المالك بنجاح!",
    data: { user: newOwner },
  });
});

// +++ 4. دالة جديدة: جلب جميع الملاك (عشان الفرونت إند يعرضهم في قائمة) +++
exports.getAllOwners = catchAsync(async (req, res, next) => {
  const owners = await User.find({ role: "owner" })
    .select("name phone email createdAt")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",
    results: owners.length,
    data: { owners },
  });
});
// +++ 5. دالة جديدة: جلب جميع العملاء مع عدد حجوزاتهم +++
exports.getAllCustomers = catchAsync(async (req, res, next) => {
  const customers = await User.aggregate([
    { $match: { role: "customer" } }, // نجيب العملاء فقط
    {
      $lookup: {
        from: "bookings",
        localField: "_id",
        foreignField: "user",
        as: "bookingsData",
      },
    },
    {
      $project: {
        name: 1,
        phone: 1,
        email: 1,
        createdAt: 1,
        verified: 1,
        bookingCount: { $size: "$bookingsData" }, // نعد المصفوفة بتاعت الحجوزات
      },
    },
    { $sort: { bookingCount: -1, createdAt: -1 } }, // الترتيب بالأكثر حجزاً
  ]);

  res.status(200).json({
    status: "success",
    results: customers.length,
    data: { customers },
  });
});
