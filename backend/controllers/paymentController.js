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
const PaymentAccount = require("../models/paymentAccountModel");
const CourtBlock = require("../models/courtBlockModel");

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
  const amountMatch = message.match(/بمبلغ\s*([0-9]+(?:\.[0-9]+)?)/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
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
// مقارنة الـ secret بزمن ثابت. لو SMS_WEBHOOK_SECRET مش متضبط نرفض كل الطلبات
// (قبل كده الهيدر "Bearer undefined" كان بيعدّي لو المتغير ناقص من .env)
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
  // الـ auth الأول، قبل أي قراءة من الـ body
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

  // تاريخ استلام غير صالح كان بيكسر إنشاء السجل (Invalid Date)
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

  // +++ التعديل الأهم: التحديث الذري (Atomic Update) في خطوة واحدة +++
  const payment = await Payment.findOneAndUpdate(
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
        // لو اتحط null على حقل unique فالـ SMS التاني من غير رقم معاملة بيفشل بـ E11000
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
    { new: true }, // لضمان إرجاع الداتا بعد التحديث مباشرة
  );
  // +++ تحديث إحصائيات حساب الدفع الفعلي (إضافة المبلغ وتاريخ آخر استلام) +++
  if (payment && payment.paymentAccount) {
    await PaymentAccount.findByIdAndUpdate(payment.paymentAccount, {
      lastTransferReceivedAt: new Date(),
      $inc: { totalMoneyCollected: parsedPayment.amount },
    });
  }

  // لو ملقاش حجز يطابق الفلوس دي، هيسجلها كفلوس معلقة (Unmatched)
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

  // تأكيد الحجز فقط لو لسه منتظر الدفع (حجز اتلغى/انتهى ماينفعش يتحيّا بسبب SMS)
  const updatedBooking = await Booking.findOneAndUpdate(
    { _id: payment.booking, status: "pending_payment" },
    {
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: payment.method,
    },
    { new: true },
  ).populate([{ path: "user", select: "name" }, "court", "venue"]);

  if (!updatedBooking) {
    // الفلوس وصلت لكن الحجز مش منتظر دفع: نسجلها للأدمن بدل ما تضيع
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

      // إشعار العميل
      if (updatedBooking.user) {
        // +++ ضمان استخراج معرف المستخدم كنص صحيح +++
        const userId =
          typeof updatedBooking.user === "object" && updatedBooking.user._id
            ? updatedBooking.user._id.toString()
            : updatedBooking.user.toString();

        const customerMsg = `تم تأكيد الدفع آلياً لحجزك في ${updatedBooking.venue.name} يوم ${bDate} الساعة ${bTime}.`;
        const customerNotif = await Notification.create({
          recipient: userId, // استخدام المتغير المستخرج
          title: "تم تأكيد الدفع بنجاح ✅",
          message: customerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });
        io.emit(`notification-${userId}`, customerNotif); // استخدام المتغير المستخرج
        io.emit(`booking-confirmed-${userId}`, {
          // استخدام المتغير المستخرج
          booking: updatedBooking,
          paymentStatus: "paid",
          status: "confirmed",
        });
      }

      // إشعار المالك
      if (updatedBooking.venue.owner) {
        const ownerMsg = `تأكيد آلي: حجز جديد (${payment.method}) في ${updatedBooking.court.name} يوم ${bDate} الساعة ${bTime}.`;
        const ownerNotif = await Notification.create({
          recipient: updatedBooking.venue.owner,
          title: "حجز تطبيق جديد 💸",
          message: ownerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });
        io.emit(`notification-${updatedBooking.venue.owner}`, ownerNotif);
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
    const startOfDay = new Date(req.query.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(req.query.date);
    endOfDay.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
  }

  // +++ التعديل الهندسي: فلترة الملاعب برمجياً في الداتابيز بدلاً من الجافاسكربت +++
  let venueIdsToFilter = [];

  if (req.user && req.user.role === "owner") {
    const myVenues = await Venue.find({ owner: req.user.id }).select("_id");
    venueIdsToFilter = myVenues.map((v) => v._id.toString());

    // إذا كان المالك يبحث عن ملعب معين، نتأكد أولاً أنه يملكه
    if (req.query.venue) {
      if (!venueIdsToFilter.includes(req.query.venue)) {
        return next(new AppError("غير مصرح لك بعرض مدفوعات هذا الملعب", 403));
      }
      venueIdsToFilter = [req.query.venue];
    }
  } else if (req.user && req.user.role === "employee") {
    // الموظف يشوف مدفوعات ناديه بس
    if (!req.user.venue) {
      return next(new AppError("حسابك غير مرتبط بنادي، تواصل مع الإدارة", 403));
    }
    venueIdsToFilter = [req.user.venue.toString()];
  } else if (req.query.venue) {
    // إذا كان أدمن ويبحث عن ملعب
    venueIdsToFilter = [req.query.venue];
  }

  // إذا كان هناك ملاعب مطلوبة الفلترة بها، نبحث عن حجوزاتها أولاً
  if (venueIdsToFilter.length > 0) {
    const Booking = require("../models/bookingModel"); // جلب الموديل هنا إذا لم يكن بالأعلى
    const validBookings = await Booking.find({
      venue: { $in: venueIdsToFilter },
    }).select("_id");
    const validBookingIds = validBookings.map((b) => b._id);

    // إجبار استعلام المدفوعات على إرجاع المدفوعات المرتبطة بهذه الحجوزات فقط
    filter.booking = { $in: validBookingIds };
  }

  // +++ تطبيق الـ Pagination +++
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const totalDocuments = await Payment.countDocuments(filter);
  const totalPages = Math.ceil(totalDocuments / limit);

  // rawPaymentData = نص رسالة الـ SMS كامل (اسم المرسل ورقمه وممكن رصيد المحفظة)
  // مايتبعتش للملاك والموظفين
  const payments = await Payment.find(filter)
    .select(req.user.role === "admin" ? "-__v +rawPaymentData" : "-__v")
    .populate({
      path: "booking",
      select:
        "startTime endTime status venue user court guestData deposit totalPrice",
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

// +++ قفل الأمان 2: الأموال المعلقة للـ Admin حصراً +++
exports.getUnmatchedPayments = catchAsync(async (req, res, next) => {
  if (req.user && req.user.role !== "admin") {
    return next(
      new AppError("غير مصرح! هذه الصفحة مخصصة للإدارة العليا فقط", 403),
    );
  }

  let filter = {};
  if (req.query.date) {
    const startOfDay = new Date(req.query.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(req.query.date);
    endOfDay.setHours(23, 59, 59, 999);
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
    { new: true },
  );

  if (!unmatched) return next(new AppError("التحويل غير موجود", 404));

  res.status(200).json({
    status: "success",
    message: "تم معالجة التحويل",
    data: { unmatched },
  });
});

// 1. تعديل دالة التأكيد اليدوي (عشان لو الأدمن أكد، المالك يجيله إشعار)
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
    // التحويلات الإلكترونية للأدمن فقط. القيد كان على المالك بس، فالموظف كان يقدر
    // يأكد أي تحويل فودافون/انستاباي بدون ما فلوس توصل = حجز مجاني.
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

    // + إغلاقات الإدارة (الصيانة/الأكاديمية): كانت مش بتتفحص قبل إحياء الحجز
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

  // "حجز" الدفعة بشكل ذري: ضغطتين متزامنتين (أو SMS وصل في نفس اللحظة) = واحدة بس
  // تكمّل. قبل كده كان بيتحسب totalMoneyCollected مرتين.
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
    { new: true },
  );
  if (!claimed) return next(new AppError("هذا الدفع مؤكد مسبقاً", 400));

  // نعكس التحديث على الـ document اللي هيترجع في الرد
  payment.status = claimed.status;
  payment.verifiedAt = claimed.verifiedAt;
  payment.verificationMethod = claimed.verificationMethod;
  payment.verificationNotes = claimed.verificationNotes;
  // +++ تحديث إحصائيات الحساب عند التأكيد اليدوي من الإدارة +++
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
    { new: true },
  ).populate([{ path: "user", select: "name" }, "court", "venue"]);

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

      // إشعار للعميل
      // إشعار للعميل
      if (updatedBooking.user) {
        // +++ ضمان استخراج معرف المستخدم كنص صحيح +++
        const userId =
          typeof updatedBooking.user === "object" && updatedBooking.user._id
            ? updatedBooking.user._id.toString()
            : updatedBooking.user.toString();

        const customerMsg = `تم تأكيد الدفع وتأكيد حجزك في ${updatedBooking.venue.name} يوم ${bDate} الساعة ${bTime}.`;
        const customerNotif = await Notification.create({
          recipient: userId, // استخدام المتغير المستخرج
          title: "تم تأكيد الدفع ✅",
          message: customerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });
        io.emit(`notification-${userId}`, customerNotif);
        io.emit(`booking-confirmed-${userId}`, {
          booking: updatedBooking,
          paymentStatus: "paid",
          status: "confirmed",
        });
      }

      // +++ إضافة: إشعار لصاحب الملعب (لو شخص آخر غير اللي داس على الزرار هو اللي أكد) +++
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
        io.emit(`notification-${venueOwnerId}`, ownerNotif);
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
// الأنواع المسموحة فقط (image/svg+xml كان بيعدّي من startsWith("image") وملف SVG
// بيشغّل سكريبت لما يتفتح من الرابط = XSS على دومين الـ API)
const ALLOWED_PROOF_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "public/uploads/payments";

    // +++ إنشاء المجلد تلقائياً إذا لم يكن موجوداً لمنع خطأ ENOENT +++
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // اسم عشوائي مايتخمنش (الإثباتات فيها أسماء وأرقام) وامتداد من القائمة المسموحة
    const ext = ALLOWED_PROOF_TYPES[file.mimetype];
    cb(null, `payment-${crypto.randomBytes(16).toString("hex")}.${ext}`);
  },
});

const upload = multer({
  storage: multerStorage,
  // من غير limits أي مستخدم يقدر يرفع ملفات ضخمة ويملا الهارد (18GB)
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, fieldSize: 2048 },
  fileFilter: (req, file, cb) =>
    ALLOWED_PROOF_TYPES[file.mimetype]
      ? cb(null, true)
      : cb(new AppError("الصور المسموحة: JPG أو PNG أو WebP فقط", 400), false),
});

// لو الطلب اترفض بعد ما الصورة اتحفظت، نمسحها (وإلا بتتراكم على الهارد)
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

  // رفع الإثبات إجراء للعميل صاحب الحجز فقط (القيد كان على role العميل بس،
  // فأي مالك أو موظف كان يقدر يرفع إثبات على دفعة أي حجز)
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

  // +++ السطر اللي كان ناقص عشان يحفظ رقم التليفون اللي العميل كتبه +++
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
        io.emit(`notification-${venueOwnerId}`, ownerNotif);
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

// +++ دالة تصفية الحسابات والتقارير للمالك (محدثة بتفاصيل الملاعب) +++
// +++ دالة تصفية الحسابات والتقارير (تدعم المالك والأدمن وتصلح مشكلة الكسور) +++
// +++ دالة تصفية الحسابات والتقارير (تدعم المالك والأدمن وتصلح مشكلة الحجوزات القديمة) +++
exports.getFinancialReports = catchAsync(async (req, res, next) => {
  const { startDate, endDate, venue } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("يرجى تحديد تاريخ البداية والنهاية", 400));
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return next(new AppError("صيغة التاريخ غير صحيحة", 400));
  }

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return next(
      new AppError("عذراً، أقصى مدة لاستخراج التقرير هي 30 يوماً", 400),
    );
  }

  let venueMatch = {};

  // الموظف كان بيمر على venueMatch = {} ويشوف تقارير كل المنصة (إيرادات كل النوادي +
  // العمولات). دلوقتي النادي بيتحدد من حسابه هو (userModel.venue) مش من الـ query.
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
      $match: {
        status: "verified",
        createdAt: { $gte: start, $lte: end },
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

  if (Object.keys(venueMatch).length > 0) {
    pipeline.push({ $match: venueMatch });
  }

  pipeline.push(
    // +++ التعديل الجوهري: تجميع الفواتير المتعددة لنفس الحجز في سطر واحد +++
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
        hasOnlinePayment: {
          $max: { $cond: [{ $ne: ["$method", "cash"] }, 1, 0] },
        },
        hasCashPayment: {
          $max: { $cond: [{ $eq: ["$method", "cash"] }, 1, 0] },
        },
      },
    },
    // +++ حساب مدة الحجز والسعر الإجمالي للحجز بعد جمع فواتيره +++
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
    // +++ حساب العمولة (ستحسب مرة واحدة فقط لكل حجز) +++
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
      $facet: {
        overall: [
          {
            $group: {
              _id: null,
              totalOnline: { $sum: "$bookingOnlineRevenue" },
              totalCash: { $sum: "$bookingCashRevenue" },
              totalCommission: { $sum: "$calculatedCommission" },
              onlineCount: { $sum: "$hasOnlinePayment" },
              cashCount: { $sum: "$hasCashPayment" },
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
              totalCash: { $sum: "$bookingCashRevenue" },
              totalCommission: { $sum: "$calculatedCommission" },
              bookingsCount: { $sum: 1 }, // الآن سيعد الحجوزات الفريدة بشكل صحيح
            },
          },
          {
            $addFields: {
              netAmount: { $subtract: ["$totalOnline", "$totalCommission"] },
            },
          },
          { $sort: { totalRevenue: -1 } },
        ],
      },
    },
  );

  const reportStats = await Payment.aggregate(pipeline);

  const stats = reportStats[0].overall[0] || {
    totalOnline: 0,
    totalCash: 0,
    totalCommission: 0,
    onlineCount: 0,
    cashCount: 0,
  };

  const courtsBreakdown = reportStats[0].courtsBreakdown || [];
  const totalOverall = stats.totalOnline + stats.totalCash;

  res.status(200).json({
    status: "success",
    data: {
      report: {
        dateRange: { from: start, to: end },
        totalOnline: Number(stats.totalOnline.toFixed(2)),
        totalCash: Number(stats.totalCash.toFixed(2)),
        totalOverall: Number(totalOverall.toFixed(2)),
        totalCommission: Number((stats.totalCommission || 0).toFixed(2)),
        transactionsCount: {
          online: stats.onlineCount,
          cash: stats.cashCount,
          total: stats.onlineCount + stats.cashCount,
        },
        courtsBreakdown,
      },
    },
  });
});
