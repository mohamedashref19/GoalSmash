const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Payment = require("../models/paymentModel");
const Booking = require("../models/bookingModel");
const UnmatchedPayment = require("../models/unmatchedPaymentModel");
const Notification = require("../models/notificationModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { emitToUser } = require("../utils/socketEmit");
const PaymentAccount = require("../models/paymentAccountModel");
const CourtBlock = require("../models/courtBlockModel");
const { getCairoCalendarDayRange } = require("../utils/accountingDay");

const idOf = (v) => ((v && v._id) || v)?.toString();

// الموظف مربوط بنادي واحد (userModel.venue): كل صلاحياته محصورة فيه.
// موظف من غير نادي مربوط = مرفوض في كل حاجة.
const isOtherVenueEmployee = (user, venueRef) =>
  user.role === "employee" &&
  (!user.venue || user.venue.toString() !== idOf(venueRef));

// +++ 1. تحسين دالة الـ Regex لتكون أكثر مرونة مع تغيرات مسافات رسائل فودافون وإنستا باي +++
const parsePaymentSMS = (sender, message) => {
  let amount = null;
  let senderPhone = null;
  let senderName = null;
  let transactionId = null;
  let method = "unknown";

  const senderLower = sender ? sender.toLowerCase() : "";

  // دعم الفواصل العشرية العربية أو الإنجليزية والمسافات المتغيرة
  // يدعم الفاصلة بين الآلاف ("1,250.00") عشان المبلغ ما يتقرأش "1"
  const amountMatch = message.match(/بمبلغ\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  if (
    senderLower.includes("instapay") ||
    message.includes("انستا باى") ||
    message.includes("instapay") ||
    message.includes("تحويل لحظي") ||
    message.includes("رقم مرجعي")
  ) {
    method = "instapay";
    const nameMatch = message.match(/من\s+(.*?)\s+رقم مرجعي/);
    if (nameMatch) senderName = nameMatch[1].trim();

    const trxMatch = message.match(/رقم مرجعي\s*([0-9A-Za-z]+)/);
    if (trxMatch) transactionId = trxMatch[1].trim();
  } else if (
    senderLower.includes("vodafone") ||
    senderLower.includes("v-cash") ||
    message.includes("تحويل أموال") ||
    message.includes("كاش")
  ) {
    method = "vodafone_cash";
    const phoneMatch = message.match(/(01[0125][0-9]{8})/);
    if (phoneMatch) senderPhone = phoneMatch[1];

    const nameMatch = message.match(/من\s+(.*?)(?:-01|\s*،)/);
    if (nameMatch) senderName = nameMatch[1].trim();

    // دعم صيغ مختلفة لرقم المعاملة
    const trxMatch = message.match(/(?:رقم المعاملة|عملية رقم)\s*([0-9]+)/);
    if (trxMatch) transactionId = trxMatch[1].trim();
  }

  return { amount, senderPhone, senderName, transactionId, method };
};

// 🚀 1. الـ Webhook Controller (يعمل آلياً - Production Ready)
const isValidWebhookSecret = (authHeader) => {
  const secret = process.env.SMS_WEBHOOK_SECRET;
  if (!secret || typeof authHeader !== "string") return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authHeader);
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};

exports.receivePaymentSms = catchAsync(async (req, res, next) => {
  if (!isValidWebhookSecret(req.headers.authorization)) {
    return next(new AppError("Unauthorized - غير مصرح لك", 401));
  }

  const { sender, message, receivedAt } = req.body || {};
  const rawEventId = (req.body || {}).eventId;

  if (
    rawEventId === undefined ||
    rawEventId === null ||
    typeof rawEventId === "object" ||
    String(rawEventId).length === 0 ||
    String(rawEventId).length > 200
  ) {
    return next(new AppError("Missing eventId - معرف الرسالة مفقود", 400));
  }
  const eventId = String(rawEventId);

  if (typeof message !== "string" || !message || message.length > 2000) {
    return next(new AppError("Invalid message - الرسالة غير صالحة", 400));
  }
  const safeSender = typeof sender === "string" ? sender.slice(0, 100) : "";

  const allowedSenders = (process.env.SMS_ALLOWED_SENDERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  console.log("[SMS webhook] sender:", safeSender);
  if (
    allowedSenders.length > 0 &&
    !allowedSenders.some((a) => safeSender.toLowerCase().includes(a))
  ) {
    console.warn("[SMS webhook] مرسل غير معتمد تم تجاهله:", safeSender);
    return res
      .status(200)
      .json({ status: "ignored", message: "مرسل غير معتمد" });
  }

  const receivedAtDate =
    receivedAt && !Number.isNaN(new Date(receivedAt).getTime())
      ? new Date(receivedAt)
      : new Date();

  const alreadyProcessed = await Payment.findOne({ smsEventId: eventId });
  if (alreadyProcessed) {
    return res
      .status(200)
      .json({ status: "success", message: "تم معالجة هذه الرسالة مسبقاً" });
  }

  const alreadyUnmatched = await UnmatchedPayment.findOne({
    transactionId: eventId,
  });
  if (alreadyUnmatched) {
    return res
      .status(200)
      .json({ status: "success", message: "الرسالة مسجلة كغير مطابقة مسبقاً" });
  }

  const parsedPayment = parsePaymentSMS(safeSender, message);

  if (!parsedPayment.amount || parsedPayment.method === "unknown") {
    return res
      .status(200)
      .json({ status: "ignored", message: "رسالة غير مطابقة تم التجاهل." });
  }

  if (parsedPayment.transactionId) {
    const existingTransaction = await Payment.findOne({
      transactionId: parsedPayment.transactionId,
    });
    if (existingTransaction) {
      return res
        .status(200)
        .json({ status: "ignored", message: "رقم المعاملة مستخدم بالفعل" });
    }
  }

  let payment;
  try {
    payment = await Payment.findOneAndUpdate(
      {
        expectedAmount: parsedPayment.amount,
        method: parsedPayment.method,
        status: { $in: ["pending", "pending_verification"] },
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          amountReceived: parsedPayment.amount,
          senderPhone: parsedPayment.senderPhone,
          senderName: parsedPayment.senderName,
          ...(parsedPayment.transactionId
            ? { transactionId: parsedPayment.transactionId }
            : {}),
          smsEventId: eventId,
          receivedAt: receivedAtDate,
          status: "verified",
          verifiedAt: new Date(),
          verificationMethod: "sms_auto",
          rawPaymentData: message,
          verificationNotes: "تم التأكيد آلياً عبر رسائل البنك",
        },
      },
      { returnDocument: "after", sort: { createdAt: 1 } },
    );
  } catch (err) {
    if (err && err.code === 11000) {
      return res
        .status(200)
        .json({ status: "success", message: "تم معالجة هذه الرسالة مسبقاً" });
    }
    throw err;
  }

  if (payment && payment.paymentAccount) {
    await PaymentAccount.findByIdAndUpdate(payment.paymentAccount, {
      lastTransferReceivedAt: new Date(),
      $inc: { totalMoneyCollected: parsedPayment.amount },
    });
  }

  if (!payment) {
    await UnmatchedPayment.create({
      sender: safeSender,
      message: message,
      amount: parsedPayment.amount,
      method: parsedPayment.method,
      senderPhone: parsedPayment.senderPhone,
      transactionId: parsedPayment.transactionId || eventId,
      receivedAt: receivedAtDate,
    });
    return res
      .status(200)
      .json({ status: "success", message: "تم تسجيل المعاملة كغير مطابقة" });
  }

  const updatedBooking = await Booking.findOneAndUpdate(
    { _id: payment.booking, status: "pending_payment" },
    {
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: payment.method,
    },
    { returnDocument: "after" },
  ).populate([{ path: "user", select: "name email phone" }, "court", "venue"]);

  if (!updatedBooking) {
    await UnmatchedPayment.create({
      sender: safeSender,
      message: message,
      amount: parsedPayment.amount,
      method: parsedPayment.method,
      senderPhone: parsedPayment.senderPhone,
      transactionId: parsedPayment.transactionId || eventId,
      receivedAt: receivedAtDate,
    });
    return res.status(200).json({
      status: "success",
      message: "الحجز لم يعد بانتظار الدفع، تم تسجيل التحويل للمراجعة",
    });
  }

  try {
    const io = req.app.get("io");
    if (io && updatedBooking) {
      const bDate = new Date(updatedBooking.startTime).toLocaleDateString(
        "ar-EG",
      );
      const bTime = new Date(updatedBooking.startTime).toLocaleTimeString(
        "ar-EG",
        { hour: "2-digit", minute: "2-digit" },
      );

      if (updatedBooking.user) {
        const userId =
          typeof updatedBooking.user === "object" && updatedBooking.user._id
            ? updatedBooking.user._id.toString()
            : updatedBooking.user.toString();

        const customerMsg = `تم تأكيد الدفع وتأكيد حجزك في ${updatedBooking.venue.name} يوم ${bDate} الساعة ${bTime}.`;
        const customerNotif = await Notification.create({
          recipient: userId,
          title: "تم تأكيد الدفع بنجاح ✅",
          message: customerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });

        emitToUser(io, userId, `notification-${userId}`, customerNotif);

        const { user: _omitUser, ...bookingForSocket } =
          updatedBooking.toObject();
        emitToUser(io, userId, `booking-confirmed-${userId}`, {
          booking: bookingForSocket,
          paymentStatus: "paid",
          status: "confirmed",
        });

        if (updatedBooking.user && updatedBooking.user.email) {
          try {
            const Email = require("../utils/email");
            const customerEmail = new Email(
              updatedBooking.user,
              process.env.FRONTEND_URL,
            );
            customerEmail
              .sendBookingTicket(updatedBooking)
              .catch((emailErr) => {
                console.error("خطأ في إرسال تذكرة الإيميل للعميل:", emailErr);
              });
          } catch (emailErr) {
            console.error("خطأ في إرسال تذكرة الإيميل للعميل:", emailErr);
          }
        }
      }

      if (updatedBooking.venue.owner) {
        const ownerMsg = `تأكيد آلي: حجز جديد (${payment.method}) في ${updatedBooking.court.name} يوم ${bDate} الساعة ${bTime}.`;
        const ownerNotif = await Notification.create({
          recipient: updatedBooking.venue.owner,
          title: "حجز تطبيق جديد 💸",
          message: ownerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });
        emitToUser(
          io,
          updatedBooking.venue.owner,
          `notification-${updatedBooking.venue.owner}`,
          ownerNotif,
        );
      }
    }
  } catch (err) {
    console.error("خطأ في إرسال الإشعارات:", err);
  }

  return res
    .status(200)
    .json({ status: "success", message: "تم تأكيد الدفع بنجاح" });
});

exports.getPaymentStatus = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id).populate({
    path: "booking",
    populate: { path: "venue" },
  });

  if (!payment) return next(new AppError("عملية الدفع غير موجودة", 404));

  const bookingUserId = (
    payment.booking?.user?._id || payment.booking?.user
  )?.toString();

  if (req.user.role === "customer" && bookingUserId !== req.user.id) {
    return next(new AppError("ليس لديك صلاحية", 403));
  }

  if (req.user.role === "owner") {
    const venueOwner = payment.booking.venue.owner
      ? payment.booking.venue.owner.toString()
      : null;
    if (venueOwner !== req.user.id)
      return next(new AppError("غير مصرح لك", 403));
  }

  if (isOtherVenueEmployee(req.user, payment.booking?.venue)) {
    return next(new AppError("غير مصرح لك", 403));
  }

  res.status(200).json({
    status: "success",
    data: {
      payment: {
        status: payment.status,
        amount: payment.expectedAmount,
        expiresAt: payment.expiresAt,
      },
    },
  });
});

// 🛠️ 2. دوال الإدارة (Admin/Owner Endpoints)

exports.getAllPayments = catchAsync(async (req, res, next) => {
  let filter = {};

  if (req.query.status) {
    if (req.query.status === "pending")
      filter.status = { $in: ["pending", "pending_verification"] };
    else filter.status = req.query.status;
  }

  if (req.query.method) filter.method = req.query.method;

  if (req.query.date) {
    if (Number.isNaN(new Date(req.query.date).getTime())) {
      return next(new AppError("صيغة التاريخ غير صحيحة", 400));
    }
    const { startOfDay, endOfDay } = getCairoCalendarDayRange(req.query.date);

    const dateCondition = {
      $or: [
        { verifiedAt: { $gte: startOfDay, $lte: endOfDay } },
        {
          verifiedAt: { $exists: false },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        },
        {
          verifiedAt: null,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        },
      ],
    };

    const paymentsInDate = await Payment.find(dateCondition).select("booking");
    const bookingIds = paymentsInDate.map((p) => p.booking).filter(Boolean);

    if (bookingIds.length > 0) {
      filter.$or = [{ booking: { $in: bookingIds } }, ...dateCondition.$or];
    } else {
      filter.$or = dateCondition.$or;
    }
  }

  let venueIdsToFilter = [];

  if (req.user && req.user.role === "owner") {
    const myVenues = await Venue.find({ owner: req.user.id }).select("_id");
    venueIdsToFilter = myVenues.map((v) => v._id.toString());

    if (req.query.venue) {
      if (!venueIdsToFilter.includes(req.query.venue)) {
        return next(new AppError("غير مصرح لك بعرض مدفوعات هذا الملعب", 403));
      }
      venueIdsToFilter = [req.query.venue];
    }
  } else if (req.user && req.user.role === "employee") {
    if (!req.user.venue) {
      return next(new AppError("حسابك غير مرتبط بنادي، تواصل مع الإدارة", 403));
    }
    venueIdsToFilter = [req.user.venue.toString()];
  } else if (req.query.venue) {
    venueIdsToFilter = [req.query.venue];
  }

  if (venueIdsToFilter.length > 0) {
    const validBookings = await Booking.find({
      venue: { $in: venueIdsToFilter },
    }).select("_id");
    const validBookingIds = validBookings.map((b) => b._id);

    filter.booking = { $in: validBookingIds };
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const totalDocuments = await Payment.countDocuments(filter);
  const totalPages = Math.ceil(totalDocuments / limit);

  const payments = await Payment.find(filter)
    .select(req.user.role === "admin" ? "-__v +rawPaymentData" : "-__v")
    .populate({
      path: "booking",
      select:
        "startTime endTime status venue user court guestData deposit totalPrice bookingType",
      populate: [
        { path: "user", select: "name phone" },
        { path: "court", select: "name" },
        { path: "venue", select: "name owner" },
      ],
    })
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: payments.length,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalDocuments,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { payments },
  });
});

exports.getUnmatchedPayments = catchAsync(async (req, res, next) => {
  if (req.user && req.user.role !== "admin") {
    return next(
      new AppError("غير مصرح! هذه الصفحة مخصصة للإدارة العليا فقط", 403),
    );
  }

  let filter = {};
  if (req.query.date) {
    if (Number.isNaN(new Date(req.query.date).getTime())) {
      return next(new AppError("صيغة التاريخ غير صحيحة", 400));
    }
    const { startOfDay, endOfDay } = getCairoCalendarDayRange(req.query.date);
    filter.receivedAt = { $gte: startOfDay, $lte: endOfDay };
  }

  const unmatched = await UnmatchedPayment.find(filter).sort("-createdAt");
  res.status(200).json({
    status: "success",
    results: unmatched.length,
    data: { unmatched },
  });
});

exports.processUnmatchedPayment = catchAsync(async (req, res, next) => {
  if (req.user && req.user.role !== "admin") {
    return next(new AppError("غير مصرح لمعالجة الأموال المعلقة", 403));
  }

  const { adminNote } = req.body;
  const unmatched = await UnmatchedPayment.findByIdAndUpdate(
    req.params.id,
    { processed: true, adminNote: adminNote || "تمت المعالجة بدون ملاحظات" },
    { returnDocument: "after" },
  );

  if (!unmatched) return next(new AppError("التحويل غير موجود", 404));

  res.status(200).json({
    status: "success",
    message: "تم معالجة التحويل",
    data: { unmatched },
  });
});

exports.manuallyVerifyPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id).populate({
    path: "booking",
    populate: { path: "user court venue", select: "name phone owner" },
  });

  if (!payment) return next(new AppError("عملية الدفع غير موجودة", 404));

  if (req.user.role !== "admin") {
    if (req.user.role === "owner") {
      const venueOwner = payment.booking.venue.owner
        ? payment.booking.venue.owner.toString()
        : null;
      if (venueOwner !== req.user.id) {
        return next(new AppError("غير مصرح لك بتأكيد مدفوعات هذا الملعب", 403));
      }
    }
    if (isOtherVenueEmployee(req.user, payment.booking.venue)) {
      return next(new AppError("غير مصرح لك بتأكيد مدفوعات هذا الملعب", 403));
    }
    if (payment.method !== "cash") {
      return next(
        new AppError(
          "غير مصرح لك بتأكيد التحويلات الإلكترونية. هذه مسؤولية الإدارة.",
          403,
        ),
      );
    }
  }

  if (payment.status === "verified")
    return next(new AppError("هذا الدفع مؤكد مسبقاً", 400));

  if (
    payment.status === "expired" ||
    (payment.booking &&
      (payment.booking.status === "expired" ||
        payment.booking.status === "cancelled"))
  ) {
    const conflictingBooking = await Booking.findOne({
      _id: { $ne: payment.booking._id },
      court: payment.booking.court._id || payment.booking.court,
      status: { $in: ["confirmed", "pending_payment"] },
      $and: [
        { startTime: { $lt: payment.booking.endTime } },
        { endTime: { $gt: payment.booking.startTime } },
      ],
    });

    const conflictingBlock = await CourtBlock.findOne({
      court: payment.booking.court._id || payment.booking.court,
      startTime: { $lt: payment.booking.endTime },
      endTime: { $gt: payment.booking.startTime },
    });

    if (conflictingBooking || conflictingBlock) {
      return next(
        new AppError(
          "❌ لا يمكن إحياء الحجز لأن الملعب تم حجزه أو إغلاقه!",
          409,
        ),
      );
    }
  }

  const verificationNotes =
    typeof req.body.notes === "string" && req.body.notes.trim()
      ? req.body.notes.trim().slice(0, 500)
      : "تم التأكيد يدوياً بواسطة الإدارة";

  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "verified" } },
    {
      $set: {
        status: "verified",
        verifiedAt: new Date(),
        verificationMethod: "admin",
        verificationNotes,
      },
    },
    { returnDocument: "after" },
  );
  if (!claimed) return next(new AppError("هذا الدفع مؤكد مسبقاً", 400));

  payment.status = claimed.status;
  payment.verifiedAt = claimed.verifiedAt;
  payment.verificationMethod = claimed.verificationMethod;
  payment.verificationNotes = claimed.verificationNotes;

  if (payment.paymentAccount) {
    await PaymentAccount.findByIdAndUpdate(payment.paymentAccount, {
      lastTransferReceivedAt: new Date(),
      $inc: { totalMoneyCollected: payment.expectedAmount },
    });
  }

  const updatedBooking = await Booking.findByIdAndUpdate(
    payment.booking._id,
    {
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: payment.method,
    },
    { returnDocument: "after" },
  ).populate([{ path: "user", select: "name email phone" }, "court", "venue"]);

  try {
    const io = req.app.get("io");
    if (io && updatedBooking) {
      const bDate = new Date(updatedBooking.startTime).toLocaleDateString(
        "ar-EG",
      );
      const bTime = new Date(updatedBooking.startTime).toLocaleTimeString(
        "ar-EG",
        { hour: "2-digit", minute: "2-digit" },
      );

      if (updatedBooking.user) {
        const userId =
          typeof updatedBooking.user === "object" && updatedBooking.user._id
            ? updatedBooking.user._id.toString()
            : updatedBooking.user.toString();

        const customerMsg = `تم تأكيد الدفع وتأكيد حجزك في ${updatedBooking.venue.name} يوم ${bDate} الساعة ${bTime}.`;
        const customerNotif = await Notification.create({
          recipient: userId,
          title: "تم تأكيد الدفع ✅",
          message: customerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });

        emitToUser(io, userId, `notification-${userId}`, customerNotif);

        const { user: _omitUser, ...bookingForSocket } =
          updatedBooking.toObject();
        emitToUser(io, userId, `booking-confirmed-${userId}`, {
          booking: bookingForSocket,
          paymentStatus: "paid",
          status: "confirmed",
        });

        if (updatedBooking.user && updatedBooking.user.email) {
          try {
            const Email = require("../utils/email");
            const customerEmail = new Email(
              updatedBooking.user,
              process.env.FRONTEND_URL,
            );
            customerEmail
              .sendBookingTicket(updatedBooking)
              .catch((emailErr) => {
                console.error("خطأ في إرسال تذكرة الإيميل للعميل:", emailErr);
              });
          } catch (emailErr) {
            console.error("خطأ في إرسال تذكرة الإيميل للعميل:", emailErr);
          }
        }
      }

      const venueOwnerId = updatedBooking.venue.owner
        ? updatedBooking.venue.owner.toString()
        : null;
      if (venueOwnerId && venueOwnerId !== req.user.id) {
        const ownerMsg = `قامت الإدارة بتأكيد دفع وحجز (${payment.method}) في ملعب ${updatedBooking.court.name} يوم ${bDate} الساعة ${bTime}.`;
        const ownerNotif = await Notification.create({
          recipient: venueOwnerId,
          title: "تم تأكيد حجز جديد 💸",
          message: ownerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });
        emitToUser(
          io,
          venueOwnerId,
          `notification-${venueOwnerId}`,
          ownerNotif,
        );
      }
    }
  } catch (err) {
    console.error("خطأ الإشعارات:", err);
  }

  res.status(200).json({
    status: "success",
    message: "تم تأكيد الدفع بنجاح",
    data: { payment },
  });
});

// 📸 3. دوال العميل (إثبات الدفع اليدوي)
const ALLOWED_PROOF_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "public/uploads/payments";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED_PROOF_TYPES[file.mimetype];
    cb(null, `payment-${crypto.randomBytes(16).toString("hex")}.${ext}`);
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, fieldSize: 2048 },
  fileFilter: (req, file, cb) =>
    ALLOWED_PROOF_TYPES[file.mimetype]
      ? cb(null, true)
      : cb(new AppError("الصور المسموحة: JPG أو PNG أو WebP فقط", 400), false),
});

const discardUpload = (req) => {
  if (req.file) fs.unlink(req.file.path, () => {});
};

exports.uploadProofImage = upload.single("proofImage");

exports.submitPaymentProof = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id).populate({
    path: "booking",
    populate: { path: "user court venue" },
  });

  if (!payment) {
    discardUpload(req);
    return next(new AppError("عملية الدفع غير موجودة", 404));
  }

  const bookingUserId = (
    payment.booking?.user?._id || payment.booking?.user
  )?.toString();

  if (bookingUserId !== req.user.id) {
    discardUpload(req);
    return next(new AppError("ليس لديك صلاحية", 403));
  }
  if (payment.status !== "pending") {
    discardUpload(req);
    return next(new AppError("عذراً، العملية ليست قيد الانتظار", 400));
  }

  if (req.file) payment.proofImage = `/uploads/payments/${req.file.filename}`;
  if (typeof req.body.manualTransactionId === "string")
    payment.manualTransactionId = req.body.manualTransactionId.slice(0, 100);

  if (typeof req.body.senderPhone === "string" && req.body.senderPhone)
    payment.senderPhone = req.body.senderPhone.slice(0, 20);

  payment.status = "pending_verification";
  await payment.save();
  await Booking.findByIdAndUpdate(payment.booking._id, {
    paymentStatus: "pending_verification",
  });

  try {
    const io = req.app.get("io");
    if (io && payment.booking && payment.booking.venue) {
      const venueOwnerId = payment.booking.venue.owner
        ? payment.booking.venue.owner.toString()
        : null;
      const customerName = payment.booking.user.name || "عميل";
      const bTime = new Date(payment.booking.startTime).toLocaleString(
        "ar-EG",
        { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
      );

      if (venueOwnerId) {
        const ownerMsg = `قام العميل ${customerName} برفع إثبات دفع لحجزه يوم ${bTime}. يرجى المراجعة.`;
        const ownerNotif = await Notification.create({
          recipient: venueOwnerId,
          title: "إثبات دفع جديد قيد المراجعة ⏳",
          message: ownerMsg,
          type: "payment",
          relatedId: payment._id,
        });
        emitToUser(
          io,
          venueOwnerId,
          `notification-${venueOwnerId}`,
          ownerNotif,
        );
      }
    }
  } catch (err) {
    console.error("خطأ إشعار رفع الإثبات:", err);
  }

  res.status(200).json({
    status: "success",
    message: "تم رفع الإثبات بنجاح",
    data: { payment },
  });
});

exports.addPaymentNote = catchAsync(async (req, res, next) => {
  const { note } = req.body;
  if (!note) return next(new AppError("يرجى إرسال الملاحظة", 400));

  const payment = await Payment.findById(req.params.id).populate({
    path: "booking",
    populate: { path: "venue", select: "owner" },
  });
  if (!payment) return next(new AppError("عملية الدفع غير موجودة", 404));

  if (req.user && req.user.role === "owner") {
    const venueOwner = payment.booking.venue.owner
      ? payment.booking.venue.owner.toString()
      : null;
    if (venueOwner !== req.user.id) return next(new AppError("غير مصرح", 403));
  }

  if (req.user && isOtherVenueEmployee(req.user, payment.booking?.venue)) {
    return next(new AppError("غير مصرح", 403));
  }

  payment.verificationNotes = payment.verificationNotes
    ? `${payment.verificationNotes} - ${note}`
    : note;
  await payment.save();

  res.status(200).json({
    status: "success",
    message: "تم إضافة الملاحظة",
    data: { payment },
  });
});

// ============================================================================
// +++ دالة التقارير المالية الشاملة (موحدة على اليوم التقويمي بتوقيت القاهرة 12:00 ص -> 11:59 م) +++
// ============================================================================
exports.getFinancialReports = catchAsync(async (req, res, next) => {
  const { startDate, endDate, venue } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("يرجى تحديد تاريخ البداية والنهاية", 400));
  }

  if (
    Number.isNaN(new Date(startDate).getTime()) ||
    Number.isNaN(new Date(endDate).getTime())
  ) {
    return next(new AppError("صيغة التاريخ غير صحيحة", 400));
  }

  const { startOfDay: start } = getCairoCalendarDayRange(startDate);
  const { endOfDay: end } = getCairoCalendarDayRange(endDate);

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return next(
      new AppError("عذراً، أقصى مدة لاستخراج التقرير هي 30 يوماً", 400),
    );
  }

  let venueMatch = {};

  if (!["owner", "admin", "employee"].includes(req.user.role)) {
    return next(new AppError("غير مصرح لك بالتقارير المالية", 403));
  }

  if (req.user.role === "employee") {
    if (!req.user.venue) {
      return next(new AppError("حسابك غير مرتبط بنادي، تواصل مع الإدارة", 403));
    }
    venueMatch = {
      "bookingDetails.venue": new mongoose.Types.ObjectId(
        req.user.venue.toString(),
      ),
    };
  } else if (req.user.role === "owner") {
    if (!venue || !mongoose.isValidObjectId(venue)) {
      return next(new AppError("يرجى تحديد النادي", 400));
    }
    const venueDoc = await Venue.findById(venue);
    if (!venueDoc || venueDoc.owner.toString() !== req.user.id) {
      return next(new AppError("غير مصرح لك باستخراج تقارير هذا النادي", 403));
    }
    venueMatch = { "bookingDetails.venue": new mongoose.Types.ObjectId(venue) };
  } else if (req.user.role === "admin") {
    if (venue && venue !== "all") {
      if (!mongoose.isValidObjectId(venue)) {
        return next(new AppError("معرف النادي غير صالح", 400));
      }
      venueMatch = {
        "bookingDetails.venue": new mongoose.Types.ObjectId(venue),
      };
    }
  }

  const pipeline = [
    {
      $addFields: {
        effectiveDate: { $ifNull: ["$verifiedAt", "$createdAt"] },
      },
    },
    {
      $match: {
        status: "verified",
        effectiveDate: { $gte: start, $lte: end },
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

  if (Object.keys(venueMatch).length > 0) {
    pipeline.push({ $match: venueMatch });
  }

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
        isRestCash: {
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
    // تجميع المدفوعات لكل حجز مع الحفاظ على تفاصيل كل عملية دفع بداخلها
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
                  { $eq: ["$isRestCash", false] },
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
                  { $eq: ["$isRestCash", true] },
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
                  { $eq: ["$isRestCash", false] },
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
                  { $eq: ["$isRestCash", true] },
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
        hasInitialPaymentInPeriod: {
          $max: { $cond: ["$isRestCash", 0, 1] },
        },
        hasRestPaymentInPeriod: {
          $max: { $cond: ["$isRestCash", 1, 0] },
        },
        latestPaymentDate: { $max: "$effectiveDate" },
        payments: {
          $push: {
            _id: "$_id",
            amount: "$actualAmount",
            method: "$method",
            isRestCash: "$isRestCash",
            typeLabel: {
              $cond: [
                { $ne: ["$method", "cash"] },
                "عربون أونلاين",
                {
                  $cond: ["$isRestCash", "كاش (باقي الحجز)", "كاش (حجز يدوي)"],
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
        isAppBookingInPeriod: {
          $cond: [
            {
              $and: [
                { $eq: ["$hasInitialPaymentInPeriod", 1] },
                { $eq: ["$bookingType", "app"] },
              ],
            },
            1,
            0,
          ],
        },
        isManualBookingInPeriod: {
          $cond: [
            {
              $and: [
                { $eq: ["$hasInitialPaymentInPeriod", 1] },
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
        calculatedCommission: {
          $cond: [
            { $eq: ["$hasInitialPaymentInPeriod", 1] },
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
    {
      $facet: {
        overall: [
          {
            $group: {
              _id: null,
              totalOnline: { $sum: "$bookingOnlineRevenue" },
              totalManualCash: { $sum: "$bookingManualCashRevenue" },
              totalRestCash: { $sum: "$bookingRestCashRevenue" },
              totalCash: { $sum: "$bookingCashRevenue" },
              totalCommission: { $sum: "$calculatedCommission" },
              onlineCount: { $sum: "$onlinePaymentsCount" },
              manualCashCount: { $sum: "$manualCashPaymentsCount" },
              restCashCount: { $sum: "$restCashPaymentsCount" },
              cashCount: { $sum: "$cashPaymentsCount" },
              newBookingsCount: { $sum: "$hasInitialPaymentInPeriod" },
              appBookingsCount: { $sum: "$isAppBookingInPeriod" },
              manualBookingsCount: { $sum: "$isManualBookingInPeriod" },
              restCollectionsCount: { $sum: "$hasRestPaymentInPeriod" },
              totalTouchedBookings: { $sum: 1 },
              totalRemainingInVenue: { $sum: "$remainingAmount" },
            },
          },
        ],
        courtsBreakdown: [
          {
            $group: {
              _id: "$court",
              courtName: { $first: "$courtDetails.name" },
              venueName: { $first: "$venueDetails.name" },
              totalRevenue: { $sum: "$totalBookingRevenue" },
              totalOnline: { $sum: "$bookingOnlineRevenue" },
              totalManualCash: { $sum: "$bookingManualCashRevenue" },
              totalRestCash: { $sum: "$bookingRestCashRevenue" },
              totalCash: { $sum: "$bookingCashRevenue" },
              totalCommission: { $sum: "$calculatedCommission" },
              bookingsCount: { $sum: "$hasInitialPaymentInPeriod" },
              appBookingsCount: { $sum: "$isAppBookingInPeriod" },
              manualBookingsCount: { $sum: "$isManualBookingInPeriod" },
              restCollectionsCount: { $sum: "$hasRestPaymentInPeriod" },
              totalTouchedBookings: { $sum: 1 },
              totalRemaining: { $sum: "$remainingAmount" },
            },
          },
          {
            $addFields: {
              netAmount: {
                $round: [
                  { $subtract: ["$totalOnline", "$totalCommission"] },
                  2,
                ],
              },
            },
          },
          { $sort: { totalRevenue: -1 } },
        ],
        bookingsDetails: [
          { $sort: { latestPaymentDate: -1 } },
          {
            $project: {
              _id: 1,
              venueName: "$venueDetails.name",
              courtName: "$courtDetails.name",
              customerName: 1,
              customerPhone: 1,
              bookingType: 1,
              bookingTypeLabel: {
                $cond: [
                  { $eq: ["$bookingType", "manual"] },
                  "حجز يدوي",
                  "حجز تطبيق",
                ],
              },
              startTime: 1,
              endTime: 1,
              durationInHours: 1,
              totalPrice: 1,
              totalPaidSoFar: "$currentDeposit",
              remainingAmount: 1,
              paidInPeriodOnline: "$bookingOnlineRevenue",
              paidInPeriodManualCash: "$bookingManualCashRevenue",
              paidInPeriodRestCash: "$bookingRestCashRevenue",
              paidInPeriodTotal: "$totalBookingRevenue",
              calculatedCommission: 1,
              hasInitialPaymentInPeriod: 1,
              hasRestPaymentInPeriod: 1,
              latestPaymentDate: 1,
              payments: 1,
            },
          },
        ],
      },
    },
  );

  const reportStats = await Payment.aggregate(pipeline);

  const stats = reportStats[0].overall[0] || {
    totalOnline: 0,
    totalManualCash: 0,
    totalRestCash: 0,
    totalCash: 0,
    totalCommission: 0,
    onlineCount: 0,
    manualCashCount: 0,
    restCashCount: 0,
    cashCount: 0,
    newBookingsCount: 0,
    appBookingsCount: 0,
    manualBookingsCount: 0,
    restCollectionsCount: 0,
    totalTouchedBookings: 0,
    totalRemainingInVenue: 0,
  };

  const courtsBreakdown = reportStats[0].courtsBreakdown || [];
  const bookingsDetails = reportStats[0].bookingsDetails || [];
  const totalOverall = stats.totalOnline + stats.totalCash;

  res.status(200).json({
    status: "success",
    data: {
      report: {
        dateRange: { from: start, to: end },
        totalOnline: Number(stats.totalOnline.toFixed(2)),
        totalManualCash: Number((stats.totalManualCash || 0).toFixed(2)),
        totalRestCash: Number((stats.totalRestCash || 0).toFixed(2)),
        totalCash: Number(stats.totalCash.toFixed(2)),
        totalOverall: Number(totalOverall.toFixed(2)),
        totalCommission: Number((stats.totalCommission || 0).toFixed(2)),
        totalRemainingInVenue: Number(
          (stats.totalRemainingInVenue || 0).toFixed(2),
        ),
        transactionsCount: {
          online: stats.onlineCount,
          manualCash: stats.manualCashCount || 0,
          restCash: stats.restCashCount || 0,
          cash: stats.cashCount,
          total: stats.onlineCount + stats.cashCount,
        },
        bookingsSummary: {
          newBookingsCount: stats.newBookingsCount || 0,
          appBookingsCount: stats.appBookingsCount || 0,
          manualBookingsCount: stats.manualBookingsCount || 0,
          restCollectionsCount: stats.restCollectionsCount || 0,
          totalTouchedBookings: stats.totalTouchedBookings || 0,
        },
        courtsBreakdown,
        bookingsDetails,
      },
    },
  });
});
