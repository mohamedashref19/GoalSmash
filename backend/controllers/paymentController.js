const multer = require("multer");
const mongoose = require("mongoose");
const Payment = require("../models/paymentModel");
const Booking = require("../models/bookingModel");
const UnmatchedPayment = require("../models/unmatchedPaymentModel");
const Notification = require("../models/notificationModel");
const Venue = require("../models/venueModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const PaymentAccount = require("../models/paymentAccountModel");

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
    message.includes("instapay")
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
exports.receivePaymentSms = catchAsync(async (req, res, next) => {
  const { sender, message, receivedAt, eventId } = req.body;

  const authHeader = req.headers.authorization;
  if (
    !authHeader ||
    authHeader !== `Bearer ${process.env.SMS_WEBHOOK_SECRET}`
  ) {
    return next(new AppError("Unauthorized - غير مصرح لك", 401));
  }

  if (!eventId)
    return next(new AppError("Missing eventId - معرف الرسالة مفقود", 400));

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

  const parsedPayment = parsePaymentSMS(sender, message);

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
        transactionId: parsedPayment.transactionId,
        smsEventId: eventId,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
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
      sender: sender,
      message: message,
      amount: parsedPayment.amount,
      method: parsedPayment.method,
      senderPhone: parsedPayment.senderPhone,
      transactionId: parsedPayment.transactionId || eventId,
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
    });
    return res
      .status(200)
      .json({ status: "success", message: "تم تسجيل المعاملة كغير مطابقة" });
  }

  // تحديث حالة الحجز لـ Confirmed
  const updatedBooking = await Booking.findByIdAndUpdate(
    payment.booking,
    {
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: payment.method,
    },
    { new: true },
  ).populate("user court venue");

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
        const customerMsg = `تم تأكيد الدفع آلياً لحجزك في ${updatedBooking.venue.name} يوم ${bDate} الساعة ${bTime}.`;
        const customerNotif = await Notification.create({
          recipient: updatedBooking.user._id,
          title: "تم تأكيد الدفع بنجاح ✅",
          message: customerMsg,
          type: "booking",
          relatedId: updatedBooking._id,
        });
        io.emit(`notification-${updatedBooking.user._id}`, customerNotif);
        io.emit(`booking-confirmed-${updatedBooking.user._id}`, {
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

  const bookingUserId = payment.booking.user._id
    ? payment.booking.user._id.toString()
    : payment.booking.user.toString();

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

  let payments = await Payment.find(filter)
    .populate({
      path: "booking",
      select: "startTime endTime status venue user court guestData",
      populate: [
        { path: "user", select: "name phone" },
        { path: "court", select: "name" },
        { path: "venue", select: "name owner" },
      ],
    })
    .sort("-createdAt");

  // +++ قفل الأمان 1: المالك يرى مدفوعات ملاعبه فقط +++
  if (req.user && req.user.role === "owner") {
    const myVenues = await Venue.find({ owner: req.user.id }).select("_id");
    const myVenueIds = myVenues.map((v) => v._id.toString());

    payments = payments.filter((p) => {
      if (!p.booking || !p.booking.venue) return false;
      const vId = p.booking.venue._id
        ? p.booking.venue._id.toString()
        : p.booking.venue.toString();
      return myVenueIds.includes(vId);
    });
  }

  // فلترة إضافية برقم الملعب لو اتبعت في الـ Query (بيستخدمها الـ Admin)
  if (req.query.venue) {
    payments = payments.filter((p) => {
      if (!p.booking || !p.booking.venue) return false;
      const vId = p.booking.venue._id
        ? p.booking.venue._id.toString()
        : p.booking.venue.toString();
      return vId === req.query.venue;
    });
  }

  res
    .status(200)
    .json({ status: "success", results: payments.length, data: { payments } });
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

  if (req.user && req.user.role === "owner") {
    const venueOwner = payment.booking.venue.owner
      ? payment.booking.venue.owner.toString()
      : null;
    if (venueOwner !== req.user.id) {
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

    if (conflictingBooking) {
      return next(
        new AppError("❌ لا يمكن إحياء الحجز لأن الملعب تم حجزه!", 409),
      );
    }
  }

  payment.status = "verified";
  payment.verifiedAt = new Date();
  payment.verificationMethod = "admin";
  payment.verificationNotes =
    req.body.notes || "تم التأكيد يدوياً بواسطة الإدارة";
  await payment.save();
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
  ).populate("user court venue");

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
      if (updatedBooking.user) {
        const userId = updatedBooking.user._id.toString();
        const customerMsg = `تم تأكيد الدفع وتأكيد حجزك في ${updatedBooking.venue.name} يوم ${bDate} الساعة ${bTime}.`;
        const customerNotif = await Notification.create({
          recipient: userId,
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
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/payments"),
  filename: (req, file, cb) => {
    const ext = file.mimetype.split("/")[1];
    cb(null, `payment-${req.user.id}-${Date.now()}.${ext}`);
  },
});
const upload = multer({
  storage: multerStorage,
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image")
      ? cb(null, true)
      : cb(new AppError("صور فقط!", 400), false),
});

exports.uploadProofImage = upload.single("proofImage");

exports.submitPaymentProof = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id).populate({
    path: "booking",
    populate: { path: "user court venue" },
  });

  if (!payment) return next(new AppError("عملية الدفع غير موجودة", 404));

  const bookingUserId = payment.booking.user._id
    ? payment.booking.user._id.toString()
    : payment.booking.user.toString();
  if (req.user.role === "customer" && bookingUserId !== req.user.id)
    return next(new AppError("ليس لديك صلاحية", 403));
  if (payment.status !== "pending")
    return next(new AppError("عذراً، العملية ليست قيد الانتظار", 400));

  if (req.file) payment.proofImage = `/uploads/payments/${req.file.filename}`;
  if (req.body.manualTransactionId)
    payment.manualTransactionId = req.body.manualTransactionId;

  // +++ السطر اللي كان ناقص عشان يحفظ رقم التليفون اللي العميل كتبه +++
  if (req.body.senderPhone) payment.senderPhone = req.body.senderPhone;

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
// +++ دالة تصفية الحسابات والتقارير (تدعم المالك والأدمن وتفصل الكاش والأونلاين وتحسب الصافي) +++
exports.getFinancialReports = catchAsync(async (req, res, next) => {
  const { startDate, endDate, venue } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError("يرجى تحديد تاريخ البداية والنهاية", 400));
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 30) {
    return next(
      new AppError("عذراً، أقصى مدة لاستخراج التقرير هي 30 يوماً", 400),
    );
  }

  let venueMatch = {};

  if (req.user.role === "owner") {
    if (!venue) {
      return next(new AppError("يرجى تحديد النادي", 400));
    }
    const venueDoc = await Venue.findById(venue);
    if (!venueDoc || venueDoc.owner.toString() !== req.user.id) {
      return next(new AppError("غير مصرح لك باستخراج تقارير هذا النادي", 403));
    }
    venueMatch = { "bookingDetails.venue": new mongoose.Types.ObjectId(venue) };
  } else if (req.user.role === "admin") {
    if (venue && venue !== "all") {
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
    {
      $lookup: {
        from: "courts",
        localField: "bookingDetails.court",
        foreignField: "_id",
        as: "courtDetails",
      },
    },
    { $unwind: { path: "$courtDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "venues",
        localField: "bookingDetails.venue",
        foreignField: "_id",
        as: "venueDetails",
      },
    },
    { $unwind: { path: "$venueDetails", preserveNullAndEmptyArrays: true } },

    // +++ معالجة الحجوزات القديمة: حساب العمولة لو مش موجودة في الداتا بيز +++
    {
      $addFields: {
        "bookingDetails.durationInHours": {
          $divide: [
            {
              $subtract: [
                "$bookingDetails.endTime",
                "$bookingDetails.startTime",
              ],
            },
            1000 * 60 * 60,
          ],
        },
      },
    },
    {
      $addFields: {
        "bookingDetails.calculatedCommission": {
          $ifNull: [
            "$bookingDetails.commission", // استخدم المحفوظ لو موجود (للحجوزات الجديدة)
            {
              // احسبه لو مش موجود (للحجوزات القديمة)
              $multiply: [
                "$baseAmount",
                {
                  $cond: [
                    { $gte: ["$bookingDetails.durationInHours", 2] },
                    0.1,
                    0.05,
                  ],
                },
              ],
            },
          ],
        },
      },
    },

    {
      $facet: {
        overall: [
          {
            $group: {
              _id: null,
              totalOnline: {
                $sum: {
                  $cond: [{ $ne: ["$method", "cash"] }, "$baseAmount", 0],
                },
              },
              totalCash: {
                $sum: {
                  $cond: [{ $eq: ["$method", "cash"] }, "$baseAmount", 0],
                },
              },
              // +++ استخدام الحقل الجديد الذي يعالج القديم والجديد +++
              totalCommission: { $sum: "$bookingDetails.calculatedCommission" },
              onlineCount: {
                $sum: { $cond: [{ $ne: ["$method", "cash"] }, 1, 0] },
              },
              cashCount: {
                $sum: { $cond: [{ $eq: ["$method", "cash"] }, 1, 0] },
              },
            },
          },
        ],
        courtsBreakdown: [
          {
            $group: {
              _id: "$bookingDetails.court",
              courtName: { $first: "$courtDetails.name" },
              venueName: { $first: "$venueDetails.name" },
              totalRevenue: { $sum: "$baseAmount" },
              // +++ تجميع أموال الأونلاين والكاش لكل ملعب +++
              totalOnline: {
                $sum: {
                  $cond: [{ $ne: ["$method", "cash"] }, "$baseAmount", 0],
                },
              },
              totalCash: {
                $sum: {
                  $cond: [{ $eq: ["$method", "cash"] }, "$baseAmount", 0],
                },
              },
              // +++ استخدام الحقل الجديد للملاعب الفردية +++
              totalCommission: { $sum: "$bookingDetails.calculatedCommission" },
              bookingsCount: { $sum: 1 },
            },
          },
          // +++ إضافة حساب الصافي لكل ملعب مباشرة من الباك إند +++
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
