const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Venue = require("../models/venueModel");
const User = require("../models/userModel");
const DailySettlement = require("../models/dailySettlementModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { DEFAULT_OPEN_HOUR, parseOpenHour } = require("../utils/accountingDay");

// قراءة اليوم والساعة بتوقيت مصر دائماً
const CAIRO_TZ = "Africa/Cairo";
const cairoPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAIRO_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const getCairoHour = (dateObj) => {
  const parts = {};
  for (const p of cairoPartsFormatter.formatToParts(dateObj)) {
    parts[p.type] = p.value;
  }
  return Number(parts.hour) % 24;
};

exports.getPlatformOverview = catchAsync(async (req, res, next) => {
  const now = new Date();
  const currentCairoHour = getCairoHour(now);

  const logicalToday = new Date(now);
  // نظرة عامة على المنصة كلها: اليوم المحاسبي بيبدأ من الساعة الافتراضية للمنصة
  if (currentCairoHour < DEFAULT_OPEN_HOUR) {
    logicalToday.setDate(logicalToday.getDate() - 1);
  }
  const startOfDay = new Date(logicalToday);
  startOfDay.setHours(DEFAULT_OPEN_HOUR, 0, 0, 0);

  const platformStats = await Booking.aggregate([
    { $match: { status: { $in: ["confirmed", "completed"] } } },
    {
      $project: {
        totalPrice: 1,
        bookingType: 1,
        startTime: 1,
        durationInHours: {
          $divide: [{ $subtract: ["$endTime", "$startTime"] }, 1000 * 60 * 60],
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

exports.getVenuesPerformance = catchAsync(async (req, res, next) => {
  const venuesPerformance = await Booking.aggregate([
    { $match: { status: { $in: ["confirmed", "completed"] } } },
    {
      $project: {
        venue: 1,
        court: 1,
        totalPrice: 1,
        bookingType: 1,
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
        courtCommission: { $sum: "$calculatedCommission" },
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

exports.createOwner = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, passwordConfirm } = req.body;
  const newOwner = await User.create({
    name,
    email,
    phone,
    password,
    passwordConfirm,
    role: "owner",
    verified: true,
  });
  newOwner.password = undefined;
  res.status(201).json({
    status: "success",
    message: "تم إنشاء حساب المالك بنجاح!",
    data: { user: newOwner },
  });
});

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

exports.getAllCustomers = catchAsync(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const totalDocuments = await User.countDocuments({ role: "customer" });
  const totalPages = Math.ceil(totalDocuments / limit);

  const customers = await User.aggregate([
    { $match: { role: "customer" } },
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
        bookingCount: { $size: "$bookingsData" },
      },
    },
    { $sort: { bookingCount: -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  res.status(200).json({
    status: "success",
    results: customers.length,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalDocuments,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { customers },
  });
});

exports.getDailyClosing = catchAsync(async (req, res, next) => {
  const { date, venue } = req.query;

  const targetDate = date ? new Date(date) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return next(new AppError("صيغة التاريخ غير صحيحة", 400));
  }

  let openHour = DEFAULT_OPEN_HOUR; // لو بنستعلم عن كل الأندية مع بعض
  let venueMatch = {};

  if (venue && venue !== "all") {
    if (!mongoose.isValidObjectId(venue))
      return next(new AppError("معرف النادي غير صالح", 400));
    venueMatch = { "bookingDetails.venue": new mongoose.Types.ObjectId(venue) };

    // +++ ميعاد فتح النادي هو بداية اليوم المحاسبي +++
    const venueDoc = await Venue.findById(venue).select("openTime");
    if (venueDoc) openHour = parseOpenHour(venueDoc.openTime);
  }

  // +++ اليوم المحاسبي: من ميعاد الفتح لحد قبله بملي ثانية في اليوم التالي +++
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(openHour, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  endOfDay.setTime(endOfDay.getTime() - 1);

  const pipeline = [
    {
      $match: {
        status: "verified",
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    {
      $lookup: {
        from: "bookings",
        localField: "booking",
        foreignField: "_id",
        as: "bookingDetails",
      },
    },
    { $unwind: "$bookingDetails" },
  ];

  if (Object.keys(venueMatch).length > 0) pipeline.push({ $match: venueMatch });

  pipeline.push(
    {
      $group: {
        _id: "$bookingDetails._id",
        court: { $first: "$bookingDetails.court" },
        venue: { $first: "$bookingDetails.venue" },
        startTime: { $first: "$bookingDetails.startTime" },
        endTime: { $first: "$bookingDetails.endTime" },
        savedCommission: { $first: "$bookingDetails.commission" },
        bookingOnlineRevenue: {
          $sum: { $cond: [{ $ne: ["$method", "cash"] }, "$baseAmount", 0] },
        },
        bookingCashRevenue: {
          $sum: { $cond: [{ $eq: ["$method", "cash"] }, "$baseAmount", 0] },
        },
      },
    },
    {
      $addFields: {
        durationInHours: {
          $divide: [{ $subtract: ["$endTime", "$startTime"] }, 1000 * 60 * 60],
        },
        totalBookingRevenue: {
          $add: ["$bookingOnlineRevenue", "$bookingCashRevenue"],
        },
      },
    },
    {
      $addFields: {
        calculatedCommission: {
          $ifNull: [
            "$savedCommission",
            {
              $multiply: [
                "$totalBookingRevenue",
                { $cond: [{ $gte: ["$durationInHours", 2] }, 0.1, 0.05] },
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: "courts",
        localField: "court",
        foreignField: "_id",
        as: "courtDetails",
      },
    },
    { $unwind: { path: "$courtDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "venues",
        localField: "venue",
        foreignField: "_id",
        as: "venueDetails",
      },
    },
    { $unwind: { path: "$venueDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { venue: "$venue", court: "$court" },
        venueName: { $first: "$venueDetails.name" },
        courtName: { $first: "$courtDetails.name" },
        totalOnline: { $sum: "$bookingOnlineRevenue" },
        totalCash: { $sum: "$bookingCashRevenue" },
        totalRevenue: { $sum: "$totalBookingRevenue" },
        totalCommission: { $sum: "$calculatedCommission" },
        bookingsCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.venue",
        venueName: { $first: "$venueName" },
        venueTotalOnline: { $sum: "$totalOnline" },
        venueTotalCash: { $sum: "$totalCash" },
        venueTotalRevenue: { $sum: "$totalRevenue" },
        venueTotalCommission: { $sum: "$totalCommission" },
        venueBookingsCount: { $sum: "$bookingsCount" },
        courts: {
          $push: {
            courtId: "$_id.court",
            courtName: "$courtName",
            totalOnline: "$totalOnline",
            totalCash: "$totalCash",
            totalRevenue: "$totalRevenue",
            totalCommission: "$totalCommission",
            bookingsCount: "$bookingsCount",
            netAmount: { $subtract: ["$totalOnline", "$totalCommission"] },
          },
        },
      },
    },
    {
      $addFields: {
        venueNetAmount: {
          $subtract: ["$venueTotalOnline", "$venueTotalCommission"],
        },
      },
    },
    { $sort: { venueTotalRevenue: -1 } },
  );

  const dailyClosing = await mongoose.model("Payment").aggregate(pipeline);

  const targetDateStr = targetDate.toISOString().split("T")[0];
  const settlements = await DailySettlement.find({ dateString: targetDateStr });

  const settlementMap = {};
  settlements.forEach((s) => {
    settlementMap[s.venue.toString()] = s.isSettled;
  });

  dailyClosing.forEach((venue) => {
    venue.isSettled = settlementMap[venue._id.toString()] || false;
  });

  const platformTotals = dailyClosing.reduce(
    (acc, curr) => ({
      totalRevenue: acc.totalRevenue + curr.venueTotalRevenue,
      totalCommission: acc.totalCommission + curr.venueTotalCommission,
      totalOnline: acc.totalOnline + curr.venueTotalOnline,
      totalCash: acc.totalCash + curr.venueTotalCash,
      totalBookings: acc.totalBookings + curr.venueBookingsCount,
    }),
    {
      totalRevenue: 0,
      totalCommission: 0,
      totalOnline: 0,
      totalCash: 0,
      totalBookings: 0,
    },
  );

  res.status(200).json({
    status: "success",
    data: {
      date: targetDateStr,
      platformTotals,
      venuesClosing: dailyClosing,
    },
  });
});

exports.toggleDailySettlement = catchAsync(async (req, res, next) => {
  const { venue, date, isSettled } = req.body;

  if (!venue || !date || isSettled === undefined) {
    return next(new AppError("بيانات التصفية غير مكتملة", 400));
  }
  if (typeof venue !== "string" || !mongoose.isValidObjectId(venue)) {
    return next(new AppError("معرف النادي غير صالح", 400));
  }
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return next(new AppError("صيغة التاريخ غير صحيحة", 400));
  }

  const targetDateStr = parsedDate.toISOString().split("T")[0];

  const settlement = await DailySettlement.findOneAndUpdate(
    { venue, dateString: targetDateStr },
    { $set: { isSettled: Boolean(isSettled), settledBy: req.user.id } },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  res.status(200).json({
    status: "success",
    message: settlement.isSettled
      ? "تم تأكيد تصفية الحساب"
      : "تم إلغاء تأكيد التصفية",
    data: { isSettled: settlement.isSettled },
  });
});

exports.createEmployee = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, passwordConfirm, venue } = req.body;

  if (!venue || !mongoose.isValidObjectId(venue)) {
    return next(new AppError("يرجى اختيار نادي صالح لربط الموظف به", 400));
  }

  const venueExists = await Venue.findById(venue);
  if (!venueExists) return next(new AppError("النادي المختار غير موجود", 404));

  const newEmployee = await User.create({
    name,
    email,
    phone,
    password,
    passwordConfirm,
    role: "employee",
    venue,
    verified: true,
  });

  newEmployee.password = undefined;
  res.status(201).json({
    status: "success",
    message: "تم إنشاء حساب الموظف وربطه بالنادي بنجاح!",
    data: { user: newEmployee },
  });
});

exports.getAllEmployees = catchAsync(async (req, res, next) => {
  const employees = await User.find({ role: "employee" })
    .populate({ path: "venue", select: "name address" })
    .select("name phone email venue createdAt")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",
    results: employees.length,
    data: { employees },
  });
});

exports.deleteEmployee = catchAsync(async (req, res, next) => {
  const employee = await User.findOneAndDelete({
    _id: req.params.id,
    role: "employee",
  });

  if (!employee) return next(new AppError("لا يوجد موظف بهذا المعرف", 404));

  res.status(200).json({
    status: "success",
    message: "تم حذف حساب الموظف بنجاح",
    data: null,
  });
});
