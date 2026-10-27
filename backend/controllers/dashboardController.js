const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const Court = require("../models/courtModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { parseOpenHour } = require("../utils/accountingDay");

const DASHBOARD_ROLES = ["owner", "admin", "employee"];

const employeeNotAllowed = (user, venueId) =>
  user.role === "employee" &&
  (!user.venue || user.venue.toString() !== venueId.toString());

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

  // +++ حساب اليوم المنطقي للملعب +++
  const now = new Date();
  const openHour = parseOpenHour(venueDoc.openTime);
  const currentCairoHour = getCairoHour(now);

  const logicalToday = new Date(now);
  if (currentCairoHour < openHour) {
    // لو إحنا دلوقتي الفجر قبل ميعاد الفتح، يبقى إحنا لسه في حسابات "امبارح"
    logicalToday.setDate(logicalToday.getDate() - 1);
  }

  const startOfDay = new Date(logicalToday);
  startOfDay.setHours(openHour, 0, 0, 0);

  const endOfDay = new Date(logicalToday);
  endOfDay.setDate(endOfDay.getDate() + 1);
  endOfDay.setHours(openHour, 0, 0, 0);

  const todayStats = await Booking.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(venueId),
        startTime: { $gte: startOfDay, $lt: endOfDay },
        status: "confirmed",
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
