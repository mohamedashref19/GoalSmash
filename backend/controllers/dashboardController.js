const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Payment = require("../models/paymentModel");
const Court = require("../models/courtModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const {
  parseOpenHour,
  cairoWallTimeToUtcDate,
  getTodayCairoDateString,
  getCairoCalendarDayRange,
} = require("../utils/accountingDay");

const DASHBOARD_ROLES = ["owner", "admin", "employee"];

const employeeNotAllowed = (user, venueId) =>
  user.role === "employee" &&
  (!user.venue || user.venue.toString() !== venueId.toString());

// قراءة الساعة الحالية بتوقيت مصر دائماً
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

// إزاحة تاريخ YYYY-MM-DD بعدد أيام محدد بدقة بدون الاعتماد على توقيت السيرفر
const shiftDateStr = (dateStr, deltaDays) => {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
};

exports.getTodayStats = catchAsync(async (req, res, next) => {
  const venueId = req.query.venue;
  if (!venueId) return next(new AppError("يرجى تحديد المكان (venue)", 400));
  if (!mongoose.isValidObjectId(venueId))
    return next(new AppError("معرف المكان غير صالح", 400));
  if (!DASHBOARD_ROLES.includes(req.user?.role))
    return next(new AppError("ليس لديك صلاحية لعرض الإحصائيات", 403));

  const venueDoc = await Venue.findById(venueId);
  if (!venueDoc) return next(new AppError("هذا الملعب غير موجود", 404));

  if (
    req.user &&
    req.user.role === "owner" &&
    venueDoc.owner.toString() !== req.user.id
  ) {
    return next(new AppError("غير مصرح لك بالوصول لإحصائيات هذا الملعب!", 403));
  }
  if (employeeNotAllowed(req.user, venueDoc._id)) {
    return next(new AppError("غير مصرح لك بالوصول لإحصائيات هذا الملعب!", 403));
  }

  const now = new Date();
  const openHour = parseOpenHour(venueDoc.openTime);
  const currentCairoHour = getCairoHour(now);
  const cairoTodayStr = getTodayCairoDateString(now);

  // +++ 1. نطاق اليوم التشغيلي للجدول والحجوزات (مرتبط بساعة فتح الملعب openTime بتوقيت القاهرة) +++
  const logicalDateStr =
    currentCairoHour < openHour
      ? shiftDateStr(cairoTodayStr, -1)
      : cairoTodayStr;
  const nextLogicalDateStr = shiftDateStr(logicalDateStr, 1);

  const scheduleStart = cairoWallTimeToUtcDate(
    logicalDateStr,
    openHour,
    0,
    0,
    0,
  );
  const scheduleEnd = cairoWallTimeToUtcDate(
    nextLogicalDateStr,
    openHour,
    0,
    0,
    0,
  );

  // حساب عدد حجوزات النهاردة وساعات الإشغال (بناءً على مواعيد لعب اليوم التشغيلي)
  const todayStats = await Booking.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(venueId),
        startTime: { $gte: scheduleStart, $lt: scheduleEnd },
        status: "confirmed",
      },
    },
    {
      $group: {
        _id: null,
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
    bookingsCount: 0,
    totalBookedHours: 0,
  };

  // +++ 2. نطاق اليوم المالي (موحد على اليوم التقويمي بتوقيت القاهرة: 12:00 ص -> 11:59:59.999 م) +++
  const { startOfDay: financeStart, endOfDay: financeEnd } =
    getCairoCalendarDayRange(cairoTodayStr);

  // حساب "إيراد اليوم الفعلي" مقسماً لـ 3 خانات: أونلاين، كاش حجز يدوي، وكاش باقي الحجز
  const todayPaymentsAgg = await Payment.aggregate([
    {
      $addFields: {
        effectiveDate: { $ifNull: ["$verifiedAt", "$createdAt"] },
      },
    },
    {
      $match: {
        status: "verified",
        effectiveDate: { $gte: financeStart, $lte: financeEnd },
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
    {
      $match: {
        "bookingDetails.venue": new mongoose.Types.ObjectId(venueId),
        "bookingDetails.status": { $nin: ["cancelled", "expired", "blocked"] },
      },
    },
    {
      $addFields: {
        actualCashAmount: { $ifNull: ["$amountReceived", "$baseAmount"] },
        isRestCash: {
          $regexMatch: {
            input: { $ifNull: ["$paymentReference", ""] },
            regex: /^(CASH-REST-|QR-CASH-)/,
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        todayOnlineRevenue: {
          $sum: { $cond: [{ $ne: ["$method", "cash"] }, "$baseAmount", 0] },
        },
        todayManualCashRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$method", "cash"] },
                  { $eq: ["$isRestCash", false] },
                ],
              },
              "$actualCashAmount",
              0,
            ],
          },
        },
        todayRestCashRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$method", "cash"] },
                  { $eq: ["$isRestCash", true] },
                ],
              },
              "$actualCashAmount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const rev = todayPaymentsAgg[0] || {
    todayOnlineRevenue: 0,
    todayManualCashRevenue: 0,
    todayRestCashRevenue: 0,
  };
  const todayOnlineRevenue = Number((rev.todayOnlineRevenue || 0).toFixed(2));
  const todayManualCashRevenue = Number(
    (rev.todayManualCashRevenue || 0).toFixed(2),
  );
  const todayRestCashRevenue = Number(
    (rev.todayRestCashRevenue || 0).toFixed(2),
  );
  const todayCashRevenue = Number(
    (todayManualCashRevenue + todayRestCashRevenue).toFixed(2),
  );
  const todayRevenue = Number(
    (todayOnlineRevenue + todayCashRevenue).toFixed(2),
  );

  const activeCourtsCount = await Court.countDocuments({
    venue: venueId,
    status: "active",
  });
  const dailyOperatingHours = venueDoc.operatingHours || 24;
  const totalAvailableHours = activeCourtsCount * dailyOperatingHours;

  const occupancyRate =
    totalAvailableHours === 0
      ? 0
      : Math.round((stats.totalBookedHours / totalAvailableHours) * 100);

  res.status(200).json({
    status: "success",
    data: {
      todayRevenue,
      todayOnlineRevenue,
      todayManualCashRevenue,
      todayRestCashRevenue,
      todayCashRevenue,
      todayBookings: stats.bookingsCount,
      occupancyRate: `${Math.min(occupancyRate, 100)}%`,
      activeCourts: activeCourtsCount,
    },
  });
});

exports.getTopCustomers = catchAsync(async (req, res, next) => {
  const venueId = req.query.venue;
  if (!venueId) return next(new AppError("يرجى تحديد المكان (venue)", 400));
  if (!mongoose.isValidObjectId(venueId))
    return next(new AppError("معرف المكان غير صالح", 400));

  if (!DASHBOARD_ROLES.includes(req.user?.role)) {
    return next(new AppError("ليس لديك صلاحية لعرض هذه البيانات", 403));
  }
  if (employeeNotAllowed(req.user, venueId)) {
    return next(new AppError("غير مصرح لك بالوصول لبيانات هذا الملعب!", 403));
  }

  if (req.user && req.user.role === "owner") {
    const venueCheck = await Venue.findOne({
      _id: venueId,
      owner: req.user.id,
    });
    if (!venueCheck)
      return next(new AppError("غير مصرح لك بالوصول لبيانات هذا الملعب!", 403));
  }

  const topCustomers = await Booking.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(venueId),
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
    { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
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
    { $sort: { totalBookings: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({
    status: "success",
    results: topCustomers.length,
    data: { topCustomers },
  });
});
