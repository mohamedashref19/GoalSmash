const mongoose = require("mongoose");
const { Mutex } = require("async-mutex");
const Booking = require("../models/bookingModel");
const Payment = require("../models/paymentModel");
const Court = require("../models/courtModel");
const Venue = require("../models/venueModel");
const Notification = require("../models/notificationModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const PaymentAccount = require("../models/paymentAccountModel");
const CourtBlock = require("../models/courtBlockModel");
const {
  DEFAULT_OPEN_HOUR,
  parseOpenHour,
  parseCloseHour,
} = require("../utils/accountingDay");

const courtMutexes = new Map();

// أقصى عدد حجوزات "بانتظار الدفع" للعميل في نفس الوقت (منع حجز كل المواعيد بدون دفع)
const ACTIVE_PENDING_LIMIT = 3;
const isId = (v) => typeof v === "string" && mongoose.isValidObjectId(v);
// يرجّع الـ id سواء الحقل populated أو لأ
// (toString على document مش populated بيرجّع نص طويل مش الـ id)
const idOf = (v) => ((v && v._id) || v)?.toString();

// +++ قراءة اليوم والساعة بتوقيت مصر دائماً (مهما كان توقيت السيرفر) +++
// بنستخدم Intl بدل toLocaleString + new Date عشان مفيش parsing لنص يعتمد على توقيت السيرفر
const CAIRO_TZ = "Africa/Cairo";
const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const cairoPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAIRO_TZ,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const getCairoDateParts = (dateObj) => {
  const parts = {};
  for (const p of cairoPartsFormatter.formatToParts(dateObj)) {
    parts[p.type] = p.value;
  }
  return {
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    day: WEEKDAY_INDEX[parts.weekday], // 0 (الأحد) إلى 6 (السبت)
  };
};

// الموظف مربوط بنادي واحد (userModel.venue): كل صلاحياته محصورة فيه.
// موظف من غير نادي مربوط = مرفوض في كل حاجة.
const isOtherVenueEmployee = (user, venueRef) =>
  user.role === "employee" &&
  (!user.venue || user.venue.toString() !== idOf(venueRef));

const getCourtMutex = (courtId) => {
  if (!courtMutexes.has(courtId)) {
    courtMutexes.set(courtId, new Mutex());
  }
  return courtMutexes.get(courtId);
};

const generateUniqueAmount = async (baseAmount) => {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    attempts++;
    const fraction = Math.floor(Math.random() * 99 + 1) / 100;
    const expectedAmount = Number((baseAmount + fraction).toFixed(2));

    const exists = await Payment.exists({
      expectedAmount,
      status: { $in: ["pending", "pending_verification"] },
      expiresAt: { $gt: new Date() },
    });

    if (!exists) {
      return expectedAmount;
    }
  }
  throw new AppError("تعذر إنشاء مبلغ دفع فريد، حاول مرة أخرى", 503);
};

exports.createBooking = catchAsync(async (req, res, next) => {
  const {
    venue,
    court,
    startTime,
    endTime,
    bookingType,
    guestData,
    paymentMethod,
  } = req.body;

  if (!isId(venue) || !isId(court)) {
    return next(new AppError("بيانات النادي أو الملعب غير صالحة", 400));
  }
  if (!startTime || !endTime) {
    return next(new AppError("يرجى تحديد وقت البداية والنهاية", 400));
  }

  const venueObj = await Venue.findById(venue);
  if (!venueObj) {
    return next(new AppError("هذا النادي غير موجود", 404));
  }

  if (req.user && req.user.role === "owner") {
    if (venueObj.owner.toString() !== req.user.id) {
      return next(new AppError("غير مصرح لك بإنشاء حجز في هذا الملعب!", 403));
    }
  }

  if (req.user && isOtherVenueEmployee(req.user, venueObj._id)) {
    return next(new AppError("غير مصرح لك بإنشاء حجز في هذا الملعب!", 403));
  }

  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);

  if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
    return next(new AppError("صيغة التاريخ غير صحيحة", 400));
  }

  if (newStart >= newEnd)
    return next(new AppError("وقت النهاية يجب أن يكون بعد وقت البداية", 400));
  if (newStart < new Date())
    return next(new AppError("لا يمكنك إنشاء حجز في وقت مضى", 400));

  // +++ حماية 1: منع الأوقات العشوائية التي تخرب الجدول +++
  if (newStart.getMinutes() !== 0 || newEnd.getMinutes() !== 0) {
    return next(
      new AppError(
        "يجب أن يبدأ وينتهي الحجز على رأس الساعة تماماً (مثال: 10:00 وليس 10:15)",
        400,
      ),
    );
  }

  // +++ حماية 2: منع احتكار الملاعب وحماية النظام +++
  const durationInHours =
    (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);
  if (req.user && req.user.role === "customer" && durationInHours > 4) {
    return next(
      new AppError("الحد الأقصى للحجز عبر التطبيق هو 4 ساعات متواصلة.", 400),
    );
  }
  if (durationInHours > 12) {
    return next(new AppError("لا يمكن إنشاء حجز تتجاوز مدته 12 ساعة.", 400));
  }
  // +++ حماية جديدة: التأكد من أيام وساعات عمل النادي (بتوقيت مصر) +++
  const startParts = getCairoDateParts(newStart);
  const endParts = getCairoDateParts(newEnd);

  // +++ حساب المدة بناءً على "ساعة الحائط" لتجاهل قفزات التوقيت الصيفي/الشتوي +++
  let wallDurationMinutes =
    endParts.hour * 60 +
    endParts.minute -
    (startParts.hour * 60 + startParts.minute);
  if (wallDurationMinutes <= 0) {
    wallDurationMinutes += 24 * 60; // معالجة عبور منتصف الليل
  }
  const openHour = parseOpenHour(venueObj.openTime);
  const closeHour = parseCloseHour(venueObj.closeTime);

  // 1. أيام العمل: ساعات الفجر (قبل وقت الفتح) بتتبع سهرة اليوم السابق
  let bookingDay = startParts.day;
  if (closeHour <= openHour && startParts.hour < openHour) {
    bookingDay = (bookingDay + 6) % 7; // اليوم السابق
  }

  if (venueObj.workingDays && venueObj.workingDays.length > 0) {
    if (!venueObj.workingDays.includes(bookingDay)) {
      return next(
        new AppError("عذراً، النادي مغلق في هذا اليوم من الأسبوع.", 400),
      );
    }
  }

  // 2. التأكد من أن كل ساعة في الحجز تقع ضمن ساعات عمل النادي
  const isHourWithinSchedule = (hr) => {
    if (venueObj.operatingHours === 24 || openHour === closeHour) return true;
    if (closeHour > openHour) {
      // يفتح ويغلق في نفس اليوم (مثال: 8 صباحاً إلى 10 مساءً)
      return hr >= openHour && hr < closeHour;
    }
    // يعمل متجاوزاً منتصف الليل (مثال: 8 صباحاً إلى 4 فجراً)
    return hr >= openHour || hr < closeHour;
  };

  let isWithinWorkingHours = true;
  const totalHoursToCheck = Math.ceil(durationInHours);
  for (let i = 0; i < totalHoursToCheck; i++) {
    const checkHr = (startParts.hour + i) % 24;
    if (!isHourWithinSchedule(checkHr)) {
      isWithinWorkingHours = false;
      break;
    }
  }

  if (!isWithinWorkingHours) {
    return next(
      new AppError(
        `عذراً، مواعيد الحجز يجب أن تكون ضمن ساعات عمل النادي (من ${venueObj.openTime} إلى ${venueObj.closeTime}).`,
        400,
      ),
    );
  }

  if (req.user && (req.user.role === "owner" || req.user.role === "employee")) {
    if (!guestData || !guestData.name || !guestData.phone) {
      return next(new AppError("يجب إدخال اسم ورقم هاتف العميل", 400));
    }
    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(guestData.phone)) {
      return next(
        new AppError(
          "رقم الهاتف غير صحيح، يجب أن يتكون من 11 رقم ويبدأ بـ 01",
          400,
        ),
      );
    }
  }

  if (
    req.user &&
    req.user.role === "customer" &&
    !["vodafone_cash", "instapay"].includes(paymentMethod)
  ) {
    return next(
      new AppError("يرجى اختيار طريقة دفع صحيحة (محفظة أو انستاباي)", 400),
    );
  }

  const courtExists = await Court.findById(court);
  if (!courtExists) return next(new AppError("هذا الملعب غير موجود", 404));

  // الملعب لازم يكون تابع للنادي المرسل. من غير الفحص ده كان ممكن تحجز ملعب نادي تاني
  // باستخدام ساعات عمل وصلاحيات نادي مختلف (وتعطّل مواعيد منافس).
  // courtModel بيعمل populate للـ venue تلقائياً، فلازم idOf مش toString
  if (idOf(courtExists.venue) !== venueObj._id.toString()) {
    return next(new AppError("هذا الملعب لا يتبع هذا النادي", 400));
  }

  // ملعب في الصيانة ماينفعش يتحجز (الـ inactive بيتفلتر في الموديل، الـ maintenance لأ)
  if (courtExists.status !== "active") {
    return next(new AppError("هذا الملعب غير متاح للحجز حالياً", 400));
  }

  if (req.user && req.user.role === "customer") {
    const activePending = await Booking.countDocuments({
      user: req.user.id,
      status: "pending_payment",
      expiresAt: { $gt: new Date() },
    });
    if (activePending >= ACTIVE_PENDING_LIMIT) {
      return next(
        new AppError(
          "لديك حجوزات بانتظار الدفع، أكمل دفعها أو انتظر انتهاءها قبل حجز جديد",
          429,
        ),
      );
    }
  }

  const eveningStartHour = parseInt(
    (venueObj.eveningStartTime || "18:00").split(":")[0],
    10,
  );
  const morningStartHour = parseOpenHour(venueObj.openTime);

  const eveningPrice =
    courtExists.priceEvening !== undefined
      ? courtExists.priceEvening
      : courtExists.pricePerHour;
  const morningPrice =
    courtExists.priceMorning !== undefined
      ? courtExists.priceMorning
      : courtExists.pricePerHour;

  const durationInMinutes =
    (newEnd.getTime() - newStart.getTime()) / (1000 * 60);
  const durationBlocks = Math.round(durationInMinutes / 30);

  let calculatedTotalPrice = 0;
  let currentTempTime = new Date(newStart);

  for (let i = 0; i < durationBlocks; i++) {
    const { hour: currentHour } = getCairoDateParts(currentTempTime);
    const isCurrentBlockEvening =
      currentHour >= eveningStartHour || currentHour < morningStartHour;

    const blockPrice = isCurrentBlockEvening
      ? eveningPrice / 2
      : morningPrice / 2;
    calculatedTotalPrice += blockPrice;
    currentTempTime.setMinutes(currentTempTime.getMinutes() + 30);
  }

  calculatedTotalPrice = Number(calculatedTotalPrice.toFixed(2));

  if (!Number.isFinite(calculatedTotalPrice) || calculatedTotalPrice <= 0) {
    return next(new AppError("تعذر حساب السعر الإجمالي بشكل صحيح", 400));
  }

  const commissionRate = durationInHours >= 2 ? 0.1 : 0.05;
  const calculatedCommission = Number(
    (calculatedTotalPrice * commissionRate).toFixed(2),
  );
  let calculatedDeposit = Number((calculatedTotalPrice / 2).toFixed(2));

  // +++ حماية 3: تأمين العربون اليدوي من القيم السالبة أو التخطي للسعر الأصلي +++
  let finalManualDeposit = calculatedTotalPrice;
  if (req.body.deposit !== undefined) {
    finalManualDeposit = Number(req.body.deposit);
    if (!Number.isFinite(finalManualDeposit)) {
      return next(new AppError("قيمة العربون غير صحيحة", 400));
    }
    if (finalManualDeposit < 0) finalManualDeposit = 0;
    if (finalManualDeposit > calculatedTotalPrice)
      finalManualDeposit = calculatedTotalPrice;
  }

  const courtIdString = court.toString();
  const mutex = getCourtMutex(courtIdString);

  await mutex.runExclusive(async () => {
    const conflictingBooking = await Booking.findOne({
      court: court,
      status: { $in: ["confirmed", "pending_payment"] },
      $and: [{ startTime: { $lt: newEnd } }, { endTime: { $gt: newStart } }],
    });

    const conflictingBlock = await CourtBlock.findOne({
      court: court,
      $and: [{ startTime: { $lt: newEnd } }, { endTime: { $gt: newStart } }],
    });

    if (conflictingBooking || conflictingBlock) {
      throw new AppError(
        "عذراً، هذا الملعب محجوز بالفعل أو مغلق في هذا الوقت",
        409,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() + 10);

      let activePaymentAccount = null;
      if (req.user && req.user.role === "customer") {
        activePaymentAccount = await PaymentAccount.findOneAndUpdate(
          { type: paymentMethod, isActive: true },
          { lastUsedAt: new Date() },
          { sort: { lastUsedAt: 1 }, returnDocument: "after" },
        );

        if (!activePaymentAccount) {
          throw new AppError(
            `عذراً، لا توجد حسابات متاحة حالياً. يرجى المحاولة لاحقاً.`,
            404,
          );
        }
      }

      let bookingData = {
        venue,
        court,
        startTime: newStart,
        endTime: newEnd,
        bookingType,
        totalPrice: calculatedTotalPrice,
        commission: calculatedCommission,
        deposit:
          req.user && req.user.role === "customer"
            ? calculatedDeposit
            : finalManualDeposit,
        paymentMethod:
          req.user && req.user.role === "customer" ? paymentMethod : "cash",
        status:
          req.user && req.user.role === "customer"
            ? "pending_payment"
            : "confirmed",
        expiresAt:
          req.user && req.user.role === "customer" ? expirationTime : null,
      };

      if (req.user && req.user.role === "customer") {
        bookingData.user = req.user.id;
        bookingData.bookingType = "app";
      } else if (
        req.user &&
        (req.user.role === "owner" || req.user.role === "employee")
      ) {
        bookingData.guestData = guestData;
        bookingData.bookingType = "manual";
      }

      const [newBooking] = await Booking.create([bookingData], { session });
      let paymentData = null;

      if (req.user && req.user.role === "customer") {
        const expectedAmount = await generateUniqueAmount(calculatedDeposit);
        const reference = `PAY-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const [createdPayment] = await Payment.create(
          [
            {
              booking: newBooking._id,
              paymentReference: reference,
              method: paymentMethod,
              baseAmount: calculatedDeposit,
              expectedAmount: expectedAmount,
              expiresAt: expirationTime,
              paymentAccount: activePaymentAccount
                ? activePaymentAccount._id
                : null,
            },
          ],
          { session },
        );

        paymentData = createdPayment;
      } else if (
        req.user &&
        (req.user.role === "owner" || req.user.role === "employee")
      ) {
        const reference = `CASH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const [createdPayment] = await Payment.create(
          [
            {
              booking: newBooking._id,
              paymentReference: reference,
              method: "cash",
              baseAmount: calculatedTotalPrice,
              expectedAmount: calculatedTotalPrice,
              amountReceived: finalManualDeposit,
              status: "verified",
              verifiedAt: new Date(),
              verificationMethod: "admin",
              verificationNotes: "حجز يدوي من لوحة المالك",
              expiresAt: new Date(newStart.getTime() + 1000 * 60 * 60 * 24),
            },
          ],
          { session },
        );

        paymentData = createdPayment;
      }

      await session.commitTransaction();
      session.endSession();

      if (newBooking.status === "confirmed") {
        try {
          const bookingDate = newStart.toLocaleDateString("ar-EG");
          const bookingTime = newStart.toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const io = req.app.get("io");

          if (venueObj && venueObj.owner) {
            const customerName = guestData?.name || "عميل";
            const ownerMessage = `قام ${customerName} (حجز يدوي) بحجز ملعب ${courtExists.name} في ${venueObj.name} يوم ${bookingDate} الساعة ${bookingTime}.`;
            await Notification.create({
              recipient: venueObj.owner,
              title: "حجز يدوي جديد 📅",
              message: ownerMessage,
              type: "booking",
              relatedId: newBooking._id,
            });
            if (io)
              io.emit(`notification-${venueObj.owner}`, {
                title: "حجز جديد",
                message: ownerMessage,
              });
          }
        } catch (notifyErr) {
          console.error("خطأ الإشعارات:", notifyErr);
        }
      }

      const responseData = { booking: newBooking };
      if (paymentData) {
        responseData.payment = {
          id: paymentData._id,
          method: paymentData.method,
          amount: paymentData.expectedAmount,
          expiresAt: paymentData.expiresAt,
          instructions: activePaymentAccount
            ? {
                identifier: activePaymentAccount.identifier,
                accountName: activePaymentAccount.accountName,
              }
            : null,
        };
      }

      res.status(201).json({
        status: "success",
        data: responseData,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  });
});

exports.getAllBookings = catchAsync(async (req, res, next) => {
  let filter = {};
  filter.status = { $ne: "blocked" };

  if (req.user && req.user.role === "customer") {
    if (!req.query.venue && !req.query.court) {
      filter.user = req.user.id;
    }
  }

  if (req.user && req.user.role === "owner") {
    const myVenues = await Venue.find({ owner: req.user.id }).select("_id");
    const myVenueIds = myVenues.map((v) => v._id.toString());

    if (req.query.venue) {
      if (!myVenueIds.includes(req.query.venue)) {
        return next(new AppError("غير مصرح لك بعرض حجوزات هذا الملعب!", 403));
      }
      filter.venue = req.query.venue;
    } else {
      filter.venue = { $in: myVenueIds };
    }
  } else if (req.user && req.user.role === "employee") {
    // الموظف يشوف حجوزات ناديه بس (النادي من حسابه مش من الـ query)
    if (!req.user.venue) {
      return next(new AppError("حسابك غير مرتبط بنادي، تواصل مع الإدارة", 403));
    }
    filter.venue = req.user.venue;
  } else if (req.query.venue) {
    filter.venue = req.query.venue;
  }

  if (req.query.court) filter.court = req.query.court;
  if (req.query.status) filter.status = req.query.status;

  let startOfLogicalDay, endOfLogicalDay;

  // إعدادات الـ Pagination
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  // السماح بـ limit أعلى في حالة عرض تقويم يوم كامل لتجنب اختفاء حجوزات من التقويم
  const defaultLimit = req.query.date ? 500 : 50;
  // سقف للـ limit: من غيره ?limit=1000000 يقدر يوقّع السيرفر
  const maxLimit = req.query.date ? 500 : 100;
  const limit = Math.min(
    Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1),
    maxLimit,
  );
  const skip = (page - 1) * limit;

  if (req.query.date) {
    if (Number.isNaN(new Date(req.query.date).getTime())) {
      return next(new AppError("صيغة التاريخ غير صحيحة", 400));
    }

    // +++ تحديد بداية اليوم المحاسبي من ميعاد فتح النادي (أو الأندية) +++
    let openHour = DEFAULT_OPEN_HOUR;

    let venueIds = [];
    if (filter.venue && filter.venue.$in) {
      venueIds = filter.venue.$in;
    } else if (filter.venue) {
      venueIds = [filter.venue];
    }
    // لو الطلب بالملعب بس (من غير venue) نجيب النادي من الملعب نفسه
    if (venueIds.length === 0 && req.query.court) {
      const courtDoc = await Court.findById(req.query.court)
        .select("venue")
        .lean();
      if (courtDoc && courtDoc.venue) {
        // لو الـ venue جاي populated من hook في موديل Court ناخد الـ _id بتاعه
        const courtVenueId = courtDoc.venue._id || courtDoc.venue;
        venueIds = [courtVenueId.toString()];
      }
    }

    if (venueIds.length > 0) {
      const venueDocs = await Venue.find({ _id: { $in: venueIds } }).select(
        "openTime",
      );
      const hours = new Set(venueDocs.map((v) => parseOpenHour(v.openTime)));
      // لو كل الأندية ليها نفس ميعاد الفتح نستخدمه، غير كده نرجع للافتراضي
      if (hours.size === 1) openHour = [...hours][0];
    }

    startOfLogicalDay = new Date(req.query.date);
    startOfLogicalDay.setHours(openHour, 0, 0, 0);

    endOfLogicalDay = new Date(startOfLogicalDay);
    endOfLogicalDay.setDate(endOfLogicalDay.getDate() + 1);
    endOfLogicalDay.setTime(endOfLogicalDay.getTime() - 1);

    filter.startTime = { $gte: startOfLogicalDay, $lte: endOfLogicalDay };
  }

  // حساب إجمالي المستندات
  const totalDocuments = await Booking.countDocuments(filter);
  const totalPages = Math.ceil(totalDocuments / limit);

  const bookings = await Booking.find(filter)
    .populate({ path: "venue", select: "name address" })
    .populate({
      path: "court",
      select: "name sportType priceMorning priceEvening pricePerHour",
    })
    .populate({ path: "user", select: "name phone" })
    .populate({ path: "cancelledBy", select: "name role" })
    .sort(req.query.date ? "startTime" : "-createdAt")
    .skip(skip)
    .limit(limit);

  let processedBookings = bookings.map((b) => b.toObject());

  if (req.user && req.user.role === "customer") {
    // استعلام واحد لكل دفعات حجوزاتي المعلّقة (بدل استعلام لكل حجز)
    const myPendingIds = processedBookings
      .filter(
        (b) =>
          b.user &&
          b.user._id.toString() === req.user.id &&
          b.status === "pending_payment" &&
          b.paymentMethod !== "cash",
      )
      .map((b) => b._id);

    const pendingPayments = myPendingIds.length
      ? await Payment.find({
          booking: { $in: myPendingIds },
          status: { $in: ["pending", "pending_verification"] },
        }).select("booking status")
      : [];
    const paymentByBooking = new Map(
      pendingPayments.map((p) => [p.booking.toString(), p]),
    );

    processedBookings = processedBookings.map((b) => {
      const isMyBooking = b.user && b.user._id.toString() === req.user.id;

      if (!isMyBooking) {
        // حجوزات غيري: بس اللي الجدول محتاجه (الوقت والحالة).
        // قبل كده كانت بترجع السعر والعمولة والعربون وطريقة الدفع ومين لغى الحجز.
        return {
          _id: b._id,
          venue: b.venue,
          court: b.court,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          bookingType: b.bookingType,
        };
      }

      const payment = paymentByBooking.get(b._id.toString());
      if (payment) {
        b.paymentId = payment._id;
        b.actualPaymentStatus = payment.status;
      }
      return b;
    });
  }

  if (req.query.date && startOfLogicalDay && endOfLogicalDay) {
    let blockFilter = {
      startTime: { $lt: endOfLogicalDay },
      endTime: { $gt: startOfLogicalDay },
    };

    if (req.query.court) {
      blockFilter.court = req.query.court;
    } else if (filter.venue) {
      blockFilter.venue = filter.venue;
    }

    const blocks = await CourtBlock.find(blockFilter);

    blocks.forEach((block) => {
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime);

      const overlapStart =
        blockStart > startOfLogicalDay ? blockStart : startOfLogicalDay;
      const overlapEnd =
        blockEnd < endOfLogicalDay ? blockEnd : endOfLogicalDay;

      let current = new Date(overlapStart);

      while (current < overlapEnd) {
        processedBookings.push({
          _id: block._id.toString() + current.getHours(),
          court: block.court,
          startTime: new Date(current).toISOString(),
          endTime: new Date(current.getTime() + 60 * 60 * 1000).toISOString(),
          status: "blocked",
          bookingType: block.blockType,
          notes: block.notes,
        });
        current.setHours(current.getHours() + 1);
      }
    });
  }

  res.status(200).json({
    status: "success",
    results: processedBookings.length,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalDocuments,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { bookings: processedBookings },
  });
});

exports.getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id).populate("venue");

  if (!booking) {
    return next(new AppError("لا يوجد حجز بهذا المعرف", 404));
  }

  if (isOtherVenueEmployee(req.user, booking.venue)) {
    return next(new AppError("ليس لديك صلاحية لعرض هذا الحجز", 403));
  }

  if (req.user.role === "customer" && idOf(booking.user) !== req.user.id) {
    return next(new AppError("ليس لديك صلاحية لعرض هذا الحجز", 403));
  }

  if (
    req.user.role === "owner" &&
    booking.venue &&
    booking.venue.owner &&
    booking.venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("ليس لديك صلاحية لعرض هذا الحجز", 403));
  }

  res.status(200).json({
    status: "success",
    data: { booking },
  });
});

exports.cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id).populate("venue");

  if (!booking) return next(new AppError("لا يوجد حجز بهذا المعرف", 404));

  if (isOtherVenueEmployee(req.user, booking.venue)) {
    return next(new AppError("ليس لديك صلاحية لإلغاء هذا الحجز", 403));
  }

  const bookingUserId =
    booking.user && booking.user._id
      ? booking.user._id.toString()
      : booking.user?.toString();

  if (req.user.role === "customer" && bookingUserId !== req.user.id) {
    return next(new AppError("ليس لديك صلاحية لإلغاء هذا الحجز", 403));
  }

  if (
    req.user.role === "owner" &&
    booking.venue &&
    booking.venue.owner &&
    booking.venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("ليس لديك صلاحية لإلغاء هذا الحجز", 403));
  }

  if (booking.status === "cancelled") {
    return next(new AppError("هذا الحجز ملغى بالفعل", 400));
  }

  if (!["pending_payment", "confirmed"].includes(booking.status)) {
    return next(new AppError("لا يمكن إلغاء هذا الحجز في حالته الحالية", 400));
  }

  booking.status = "cancelled";
  booking.cancelledBy = req.user.id;
  await booking.save();

  // إنهاء أي دفعة معلّقة للحجز. من غير كده SMS متأخر كان بيلاقي الدفعة لسه pending
  // ويحيي الحجز الملغي، والموعد ممكن يكون اتحجز لعميل تاني = حجز مزدوج.
  await Payment.updateMany(
    {
      booking: booking._id,
      status: { $in: ["pending", "pending_verification"] },
    },
    { $set: { status: "expired" } },
  );

  res.status(200).json({
    status: "success",
    message: "تم إلغاء الحجز بنجاح",
    data: { booking },
  });
});

exports.updatePayment = catchAsync(async (req, res, next) => {
  const { paymentStatus, paymentMethod } = req.body;
  let { deposit } = req.body;

  if (!paymentStatus && deposit === undefined)
    return next(
      new AppError("يرجى تحديد حالة الدفع الجديدة أو العربون المحدث", 400),
    );

  if (paymentStatus && !["unpaid", "partial", "paid"].includes(paymentStatus)) {
    return next(new AppError("حالة الدفع غير صالحة", 400));
  }
  if (
    paymentMethod &&
    !["cash", "vodafone_cash", "instapay", "card"].includes(paymentMethod)
  ) {
    return next(new AppError("طريقة الدفع غير صالحة", 400));
  }
  if (deposit !== undefined) {
    deposit = Number(deposit);
    if (!Number.isFinite(deposit) || deposit < 0) {
      return next(new AppError("قيمة العربون غير صحيحة", 400));
    }
  }

  const booking = await Booking.findById(req.params.id).populate("venue");
  if (!booking) return next(new AppError("لا يوجد حجز بهذا المعرف", 404));

  if (isOtherVenueEmployee(req.user, booking.venue)) {
    return next(new AppError("ليس لديك صلاحية لتعديل دفع هذا الحجز", 403));
  }

  if (["cancelled", "expired", "blocked"].includes(booking.status)) {
    return next(new AppError("لا يمكن تعديل دفع حجز ملغي أو منتهي", 400));
  }

  // +++ التعديل: السماح بتأكيد الدفع المتبقي حتى لو كانت الحالة paid، بشرط أن يكون العربون أقل من الإجمالي +++
  const currentDeposit = booking.deposit || 0;

  if (
    booking.paymentStatus === "paid" &&
    currentDeposit >= booking.totalPrice
  ) {
    return next(
      new AppError(
        "تم تأكيد دفع هذا الحجز واستلام المبلغ بالكامل مسبقاً.",
        400,
      ),
    );
  }

  if (
    req.user.role === "owner" &&
    booking.venue &&
    booking.venue.owner &&
    booking.venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("ليس لديك صلاحية لتعديل دفع هذا الحجز", 403));
  }

  // العربون ماينفعش يعدّي السعر الإجمالي
  if (deposit !== undefined && deposit > booking.totalPrice) {
    return next(
      new AppError(
        "المبلغ المدفوع لا يمكن أن يتجاوز السعر الإجمالي للحجز",
        400,
      ),
    );
  }

  const update = {};
  if (paymentStatus) update.paymentStatus = paymentStatus;
  if (paymentMethod) update.paymentMethod = paymentMethod;
  if (deposit !== undefined) update.deposit = deposit;

  // إذا تم دفع المبلغ بالكامل، نتأكد من تغيير الحالة إلى paid
  if (deposit !== undefined && deposit === booking.totalPrice) {
    update.paymentStatus = "paid";
  }

  // +++ التعديل: إزالة شرط { paymentStatus: { $ne: "paid" } } للسماح بتحديث العربون للحجوزات الأونلاين +++
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      updatedAt: booking.updatedAt,
    },
    { $set: update },
    { returnDocument: "after", runValidators: true },
  ).populate("venue");

  if (!updatedBooking) {
    return next(
      new AppError("تم تعديل هذا الحجز للتو، حدّث الصفحة وحاول مرة أخرى", 409),
    );
  }

  // إنشاء فاتورة كاش جديدة بالمبلغ المتبقي بدلاً من تغيير القديمة
  if (deposit !== undefined && deposit > currentDeposit) {
    const difference = deposit - currentDeposit;

    await Payment.create({
      booking: booking._id,
      paymentReference: `CASH-REST-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      method: "cash",
      baseAmount: difference,
      expectedAmount: difference,
      amountReceived: difference,
      status: "verified",
      verifiedAt: new Date(),
      verificationMethod: "admin",
      verificationNotes: "تحصيل باقي المبلغ كاش في الملعب",
      expiresAt: new Date(),
    });
  }

  res.status(200).json({
    status: "success",
    message: "تم تحديث بيانات الدفع وتوثيق تحصيل الكاش بنجاح",
    data: { booking: updatedBooking },
  });
});

exports.blockCourtSlots = catchAsync(async (req, res, next) => {
  const { venue, court, dates, startTimeHour, endTimeHour, blockType, notes } =
    req.body;

  if (
    !venue ||
    !court ||
    !dates ||
    !dates.length ||
    startTimeHour === undefined ||
    endTimeHour === undefined
  ) {
    return next(
      new AppError(
        "يرجى إرسال جميع بيانات الإغلاق (النادي، الملعب، التواريخ، وساعات البداية والنهاية).",
        400,
      ),
    );
  }

  const venueObj = await Venue.findById(venue);
  if (!venueObj) return next(new AppError("النادي غير موجود", 404));

  if (req.user.role === "owner" && venueObj.owner.toString() !== req.user.id) {
    return next(new AppError("غير مصرح لك بتعديل مواعيد هذا النادي", 403));
  }

  const courtIdString = court.toString();
  const mutex = getCourtMutex(courtIdString);
  const recurrenceId = `BLOCK-${Date.now()}`;

  let createdCount = 0;
  let failedCount = 0;

  await mutex.runExclusive(async () => {
    const blocksToInsert = [];

    let minDate = new Date("2100-01-01");
    let maxDate = new Date("1970-01-01");

    for (const dateStr of dates) {
      const startDateTime = new Date(dateStr);
      startDateTime.setHours(startTimeHour, 0, 0, 0);

      const endDateTime = new Date(dateStr);
      endDateTime.setHours(endTimeHour, 0, 0, 0);

      if (endTimeHour <= startTimeHour) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
      // الساعات قبل ميعاد فتح النادي (بعد منتصف الليل) تابعة لليوم التقويمي التالي
      if (startTimeHour < parseOpenHour(venueObj.openTime)) {
        startDateTime.setDate(startDateTime.getDate() + 1);
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      if (startDateTime < minDate) minDate = startDateTime;
      if (endDateTime > maxDate) maxDate = endDateTime;

      blocksToInsert.push({
        venue,
        court,
        blockType: blockType || "maintenance",
        startTime: startDateTime,
        endTime: endDateTime,
        notes: notes || "تم الإغلاق بواسطة الإدارة",
        recurrenceId: recurrenceId,
      });
    }

    const allBookingsInRange = await Booking.find({
      court: court,
      status: { $in: ["confirmed", "pending_payment"] },
      startTime: { $lt: maxDate },
      endTime: { $gt: minDate },
    });

    const finalBlocksToInsert = [];

    for (const block of blocksToInsert) {
      const hasBookingConflict = allBookingsInRange.some(
        (cb) => cb.startTime < block.endTime && cb.endTime > block.startTime,
      );

      if (hasBookingConflict) {
        failedCount++;
      } else {
        finalBlocksToInsert.push(block);
      }
    }

    if (finalBlocksToInsert.length > 0) {
      const orConditions = finalBlocksToInsert.map((b) => ({
        startTime: { $lt: b.endTime },
        endTime: { $gt: b.startTime },
      }));

      if (orConditions.length > 0) {
        await CourtBlock.deleteMany({
          court: court,
          $or: orConditions,
        });
      }

      await CourtBlock.insertMany(finalBlocksToInsert);
      createdCount = finalBlocksToInsert.length;
    }
  });

  res.status(201).json({
    status: "success",
    message: `تمت العملية بنجاح. (${createdCount} تم إغلاقها/تحديثها، ${failedCount} فشلت لوجود حجوزات للعملاء)`,
    data: {
      createdCount,
      failedCount,
    },
  });
});

exports.getAllBlocks = catchAsync(async (req, res, next) => {
  let filter = {};

  if (req.user && req.user.role === "owner") {
    const myVenues = await Venue.find({ owner: req.user.id }).select("_id");
    const myVenueIds = myVenues.map((v) => v._id.toString());

    if (req.query.venue) {
      if (!myVenueIds.includes(req.query.venue)) {
        return next(new AppError("غير مصرح لك بعرض إغلاقات هذا الملعب!", 403));
      }
      filter.venue = req.query.venue;
    } else {
      filter.venue = { $in: myVenueIds };
    }
  } else if (req.query.venue) {
    filter.venue = req.query.venue;
  }

  if (req.query.court) filter.court = req.query.court;

  filter.endTime = { $gte: new Date() };

  const blocks = await CourtBlock.find(filter)
    .populate({ path: "venue", select: "name" })
    .populate({ path: "court", select: "name sportType" })
    .sort("startTime");

  res.status(200).json({
    status: "success",
    results: blocks.length,
    data: { blocks },
  });
});

exports.deleteBlock = catchAsync(async (req, res, next) => {
  const block = await CourtBlock.findById(req.params.id).populate("venue");

  if (!block) {
    return next(new AppError("هذا الإغلاق غير موجود أو تم حذفه بالفعل", 404));
  }

  if (
    req.user &&
    req.user.role === "owner" &&
    block.venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("غير مصرح لك بفتح مواعيد هذا النادي", 403));
  }

  await CourtBlock.findByIdAndDelete(req.params.id);

  res.status(200).json({
    status: "success",
    message: "تم إلغاء الإغلاق وفتح الموعد بنجاح",
    data: null,
  });
});

exports.deleteBlockSeries = catchAsync(async (req, res, next) => {
  const { recurrenceId } = req.params;

  if (!recurrenceId) {
    return next(new AppError("معرف المجموعة غير موجود", 400));
  }

  const sampleBlock = await CourtBlock.findOne({ recurrenceId }).populate(
    "venue",
  );

  if (!sampleBlock) {
    return next(new AppError("هذه المجموعة غير موجودة أو تم حذفها", 404));
  }

  if (
    req.user &&
    req.user.role === "owner" &&
    sampleBlock.venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("غير مصرح لك بفتح مواعيد هذا النادي", 403));
  }

  const result = await CourtBlock.deleteMany({ recurrenceId });

  res.status(200).json({
    status: "success",
    message: `تم إلغاء ${result.deletedCount} يوم بنجاح وفتح المواعيد للعملاء`,
    data: null,
  });
});
// دالة لتأكيد الحجز واستلام الكاش المتبقي عبر مسح الـ QR Code
exports.confirmViaQRCode = catchAsync(async (req, res, next) => {
  const { bookingId } = req.body;

  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    return next(new AppError("يرجى توفير معرف حجز صالح", 400));
  }

  const booking = await Booking.findById(bookingId).populate("venue");

  if (!booking) {
    return next(new AppError("لا يوجد حجز بهذا المعرف", 404));
  }

  // التأكد من الصلاحيات (أن الشخص الذي يمسح الكود هو صاحب الملعب أو موظف فيه)
  if (
    req.user.role === "owner" &&
    booking.venue &&
    booking.venue.owner &&
    booking.venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("ليس لديك صلاحية لتأكيد مدفوعات هذا النادي", 403));
  }

  if (isOtherVenueEmployee(req.user, booking.venue)) {
    return next(new AppError("ليس لديك صلاحية لتأكيد مدفوعات هذا النادي", 403));
  }

  // التأكد من حالة الحجز
  if (["cancelled", "expired", "blocked"].includes(booking.status)) {
    return next(
      new AppError(`عذراً، لا يمكن تأكيد حجز حالته: ${booking.status}`, 400),
    );
  }

  const currentDeposit = booking.deposit || 0;
  const remaining = Math.max(booking.totalPrice - currentDeposit, 0);

  // إذا كان الحجز مدفوع بالكامل بالفعل
  if (
    booking.paymentStatus === "paid" &&
    currentDeposit >= booking.totalPrice
  ) {
    return res.status(200).json({
      status: "success",
      message: "هذا الحجز مؤكد ومدفوع بالكامل مسبقاً",
      data: { booking },
    });
  }

  // تحديث حالة الحجز ليكون مؤكد ومدفوع بالكامل
  booking.status = "confirmed";
  booking.paymentStatus = "paid";
  booking.deposit = booking.totalPrice; // تم دفع الباقي كاش

  // حفظ الحجز
  await booking.save({ validateBeforeSave: false });

  // إذا كان هناك مبلغ متبقي (لم يدفع أونلاين)، نقوم بإنشاء فاتورة كاش توثق استلامه يدوياً
  if (remaining > 0) {
    await Payment.create({
      booking: booking._id,
      paymentReference: `QR-CASH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      method: "cash",
      baseAmount: remaining,
      expectedAmount: remaining,
      amountReceived: remaining,
      status: "verified",
      verifiedAt: new Date(),
      verificationMethod: "admin",
      verificationNotes: "تحصيل باقي المبلغ كاش عبر مسح الـ QR Code من الملعب",
      expiresAt: new Date(),
    });
  }

  res.status(200).json({
    status: "success",
    message: "تم مسح الكود، تأكيد الحجز، وتوثيق استلام الكاش بنجاح!",
    data: { booking },
  });
});
