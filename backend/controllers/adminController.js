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
            appBookingsCount: "$courtAppBookings",
            manualBookingsCount: "$courtManualBookings",
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

// ============================================================================
// +++ دالة تقفيل اليومية الشاملة (تفصيل الكاش، الحجوزات، العمولات، وسجل العمليات لكل نادي) +++
// ============================================================================
exports.getDailyClosing = catchAsync(async (req, res, next) => {
  const { date, venue } = req.query;

  const targetDate = date ? new Date(date) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return next(new AppError("صيغة التاريخ غير صحيحة", 400));
  }

  let openHour = DEFAULT_OPEN_HOUR;
  let venueMatch = {};

  if (venue && venue !== "all") {
    if (!mongoose.isValidObjectId(venue))
      return next(new AppError("معرف النادي غير صالح", 400));
    venueMatch = { "bookingDetails.venue": new mongoose.Types.ObjectId(venue) };

    const venueDoc = await Venue.findById(venue).select("openTime");
    if (venueDoc) openHour = parseOpenHour(venueDoc.openTime);
  }

  // اليوم المحاسبي: من ميعاد الفتح لحد قبله بملي ثانية في اليوم التالي
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(openHour, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  endOfDay.setTime(endOfDay.getTime() - 1);

  const pipeline = [
    {
      $addFields: {
        effectiveDate: { $ifNull: ["$verifiedAt", "$createdAt"] },
      },
    },
    {
      $match: {
        status: "verified",
        effectiveDate: { $gte: startOfDay, $lte: endOfDay },
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
        "bookingDetails.status": { $nin: ["cancelled", "expired", "blocked"] },
      },
    },
  ];

  if (Object.keys(venueMatch).length > 0) pipeline.push({ $match: venueMatch });

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "bookingDetails.user",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        isRestCashPayment: {
          $regexMatch: {
            input: { $ifNull: ["$paymentReference", ""] },
            regex: /^(CASH-REST-|QR-CASH-)/,
          },
        },
        actualAmount: {
          $cond: [
            { $eq: ["$method", "cash"] },
            { $ifNull: ["$amountReceived", "$baseAmount"] },
            "$baseAmount",
          ],
        },
      },
    },
    {
      $group: {
        _id: "$bookingDetails._id",
        court: { $first: "$bookingDetails.court" },
        venue: { $first: "$bookingDetails.venue" },
        bookingType: { $first: "$bookingDetails.bookingType" },
        startTime: { $first: "$bookingDetails.startTime" },
        endTime: { $first: "$bookingDetails.endTime" },
        totalPrice: { $first: "$bookingDetails.totalPrice" },
        currentDeposit: { $first: "$bookingDetails.deposit" },
        savedCommission: { $first: "$bookingDetails.commission" },
        customerName: {
          $first: {
            $ifNull: [
              "$bookingDetails.guestData.name",
              "$userDetails.name",
              "عميل",
            ],
          },
        },
        customerPhone: {
          $first: {
            $ifNull: [
              "$bookingDetails.guestData.phone",
              "$userDetails.phone",
              "بدون رقم",
            ],
          },
        },
        bookingOnlineRevenue: {
          $sum: { $cond: [{ $ne: ["$method", "cash"] }, "$actualAmount", 0] },
        },
        bookingManualCashRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$method", "cash"] },
                  { $eq: ["$isRestCashPayment", false] },
                ],
              },
              "$actualAmount",
              0,
            ],
          },
        },
        bookingRestCashRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$method", "cash"] },
                  { $eq: ["$isRestCashPayment", true] },
                ],
              },
              "$actualAmount",
              0,
            ],
          },
        },
        bookingCashRevenue: {
          $sum: {
            $cond: [{ $eq: ["$method", "cash"] }, "$actualAmount", 0],
          },
        },
        onlinePaymentsCount: {
          $sum: { $cond: [{ $ne: ["$method", "cash"] }, 1, 0] },
        },
        manualCashPaymentsCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$method", "cash"] },
                  { $eq: ["$isRestCashPayment", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
        restCashPaymentsCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$method", "cash"] },
                  { $eq: ["$isRestCashPayment", true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        cashPaymentsCount: {
          $sum: { $cond: [{ $eq: ["$method", "cash"] }, 1, 0] },
        },
        hasInitialPaymentToday: {
          $max: { $cond: ["$isRestCashPayment", 0, 1] },
        },
        hasRestPaymentToday: {
          $max: { $cond: ["$isRestCashPayment", 1, 0] },
        },
        latestPaymentDate: { $max: "$effectiveDate" },
        payments: {
          $push: {
            _id: "$_id",
            amount: "$actualAmount",
            method: "$method",
            isRestCash: "$isRestCashPayment",
            typeLabel: {
              $cond: [
                { $ne: ["$method", "cash"] },
                "عربون أونلاين",
                {
                  $cond: [
                    "$isRestCashPayment",
                    "كاش (باقي الحجز)",
                    "كاش (حجز يدوي)",
                  ],
                },
              ],
            },
            date: "$effectiveDate",
            reference: "$paymentReference",
            notes: "$verificationNotes",
          },
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
        remainingAmount: {
          $max: [
            {
              $subtract: [
                { $ifNull: ["$totalPrice", 0] },
                { $ifNull: ["$currentDeposit", 0] },
              ],
            },
            0,
          ],
        },
        isAppBookingToday: {
          $cond: [
            {
              $and: [
                { $eq: ["$hasInitialPaymentToday", 1] },
                { $eq: ["$bookingType", "app"] },
              ],
            },
            1,
            0,
          ],
        },
        isManualBookingToday: {
          $cond: [
            {
              $and: [
                { $eq: ["$hasInitialPaymentToday", 1] },
                { $eq: ["$bookingType", "manual"] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        fullBookingCommission: {
          $ifNull: [
            "$savedCommission",
            {
              $multiply: [
                "$totalPrice",
                { $cond: [{ $gte: ["$durationInHours", 2] }, 0.1, 0.05] },
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        // العمولة تُخصم مرة واحدة فقط في يوم الدفعة الأولى
        calculatedCommission: {
          $cond: [
            { $eq: ["$hasInitialPaymentToday", 1] },
            "$fullBookingCommission",
            0,
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
    { $sort: { latestPaymentDate: -1 } },
    {
      $group: {
        _id: { venue: "$venue", court: "$court" },
        venueName: { $first: "$venueDetails.name" },
        courtName: { $first: "$courtDetails.name" },
        totalOnline: { $sum: "$bookingOnlineRevenue" },
        totalManualCash: { $sum: "$bookingManualCashRevenue" },
        totalRestCash: { $sum: "$bookingRestCashRevenue" },
        totalCash: { $sum: "$bookingCashRevenue" },
        totalRevenue: { $sum: "$totalBookingRevenue" },
        totalCommission: { $sum: "$calculatedCommission" },
        totalRemaining: { $sum: "$remainingAmount" },
        onlineTransactionsCount: { $sum: "$onlinePaymentsCount" },
        cashTransactionsCount: { $sum: "$cashPaymentsCount" },
        bookingsCount: { $sum: "$hasInitialPaymentToday" },
        appBookingsCount: { $sum: "$isAppBookingToday" },
        manualBookingsCount: { $sum: "$isManualBookingToday" },
        restCollectionsCount: { $sum: "$hasRestPaymentToday" },
        courtBookingsDetails: {
          $push: {
            _id: "$_id",
            venueName: "$venueDetails.name",
            courtName: "$courtDetails.name",
            customerName: "$customerName",
            customerPhone: "$customerPhone",
            bookingType: "$bookingType",
            bookingTypeLabel: {
              $cond: [
                { $eq: ["$bookingType", "manual"] },
                "حجز يدوي",
                "حجز تطبيق",
              ],
            },
            startTime: "$startTime",
            endTime: "$endTime",
            durationInHours: "$durationInHours",
            totalPrice: "$totalPrice",
            totalPaidSoFar: "$currentDeposit",
            remainingAmount: "$remainingAmount",
            paidTodayOnline: "$bookingOnlineRevenue",
            paidTodayManualCash: "$bookingManualCashRevenue",
            paidTodayRestCash: "$bookingRestCashRevenue",
            paidTodayTotal: "$totalBookingRevenue",
            calculatedCommission: "$calculatedCommission",
            hasInitialPaymentToday: "$hasInitialPaymentToday",
            hasRestPaymentToday: "$hasRestPaymentToday",
            latestPaymentDate: "$latestPaymentDate",
            payments: "$payments",
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id.venue",
        venueName: { $first: "$venueName" },
        venueTotalOnline: { $sum: "$totalOnline" },
        venueTotalManualCash: { $sum: "$totalManualCash" },
        venueTotalRestCash: { $sum: "$totalRestCash" },
        venueTotalCash: { $sum: "$totalCash" },
        venueTotalRevenue: { $sum: "$totalRevenue" },
        venueTotalCommission: { $sum: "$totalCommission" },
        venueTotalRemaining: { $sum: "$totalRemaining" },
        venueOnlineTransactionsCount: { $sum: "$onlineTransactionsCount" },
        venueCashTransactionsCount: { $sum: "$cashTransactionsCount" },
        venueBookingsCount: { $sum: "$bookingsCount" },
        venueAppBookingsCount: { $sum: "$appBookingsCount" },
        venueManualBookingsCount: { $sum: "$manualBookingsCount" },
        venueRestCollectionsCount: { $sum: "$restCollectionsCount" },
        courts: {
          $push: {
            courtId: "$_id.court",
            courtName: "$courtName",
            totalOnline: "$totalOnline",
            totalManualCash: "$totalManualCash",
            totalRestCash: "$totalRestCash",
            totalCash: "$totalCash",
            totalRevenue: "$totalRevenue",
            totalCommission: "$totalCommission",
            totalRemaining: "$totalRemaining",
            bookingsCount: "$bookingsCount",
            appBookingsCount: "$appBookingsCount",
            manualBookingsCount: "$manualBookingsCount",
            restCollectionsCount: "$restCollectionsCount",
            netAmount: {
              $round: [{ $subtract: ["$totalOnline", "$totalCommission"] }, 2],
            },
          },
        },
        allCourtBookingsNested: { $push: "$courtBookingsDetails" },
      },
    },
    {
      $addFields: {
        venueNetAmount: {
          $round: [
            { $subtract: ["$venueTotalOnline", "$venueTotalCommission"] },
            2,
          ],
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

  dailyClosing.forEach((v) => {
    v.isSettled = settlementMap[v._id.toString()] || false;
    // فرد مصفوفة الحجوزات التفصيلية وترتيبها بالأحدث لكل نادي
    const flatBookings = (v.allCourtBookingsNested || []).flat();
    flatBookings.sort(
      (a, b) =>
        new Date(b.latestPaymentDate).getTime() -
        new Date(a.latestPaymentDate).getTime(),
    );
    v.bookingsDetails = flatBookings;
    delete v.allCourtBookingsNested;
  });

  const platformTotals = dailyClosing.reduce(
    (acc, curr) => ({
      totalRevenue: Number(
        (acc.totalRevenue + curr.venueTotalRevenue).toFixed(2),
      ),
      totalCommission: Number(
        (acc.totalCommission + curr.venueTotalCommission).toFixed(2),
      ),
      totalOnline: Number((acc.totalOnline + curr.venueTotalOnline).toFixed(2)),
      totalManualCash: Number(
        (acc.totalManualCash + (curr.venueTotalManualCash || 0)).toFixed(2),
      ),
      totalRestCash: Number(
        (acc.totalRestCash + (curr.venueTotalRestCash || 0)).toFixed(2),
      ),
      totalCash: Number((acc.totalCash + curr.venueTotalCash).toFixed(2)),
      totalRemaining: Number(
        (acc.totalRemaining + (curr.venueTotalRemaining || 0)).toFixed(2),
      ),
      onlineTransactionsCount:
        acc.onlineTransactionsCount + (curr.venueOnlineTransactionsCount || 0),
      cashTransactionsCount:
        acc.cashTransactionsCount + (curr.venueCashTransactionsCount || 0),
      totalBookings: acc.totalBookings + curr.venueBookingsCount,
      appBookingsCount:
        acc.appBookingsCount + (curr.venueAppBookingsCount || 0),
      manualBookingsCount:
        acc.manualBookingsCount + (curr.venueManualBookingsCount || 0),
      restCollectionsCount:
        acc.restCollectionsCount + (curr.venueRestCollectionsCount || 0),
    }),
    {
      totalRevenue: 0,
      totalCommission: 0,
      totalOnline: 0,
      totalManualCash: 0,
      totalRestCash: 0,
      totalCash: 0,
      totalRemaining: 0,
      onlineTransactionsCount: 0,
      cashTransactionsCount: 0,
      totalBookings: 0,
      appBookingsCount: 0,
      manualBookingsCount: 0,
      restCollectionsCount: 0,
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
