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

const courtMutexes = new Map();

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

  const venueObj = await Venue.findById(venue);
  if (!venueObj) {
    return next(new AppError("هذا النادي غير موجود", 404));
  }

  if (req.user && req.user.role === "owner") {
    if (venueObj.owner.toString() !== req.user.id) {
      return next(new AppError("غير مصرح لك بإنشاء حجز في هذا الملعب!", 403));
    }
  }

  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);

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
  // +++ حماية جديدة: التأكد من أيام وساعات عمل النادي +++
  const bookingDay = newStart.getDay(); // يرجع رقم من 0 (الأحد) إلى 6 (السبت)
  if (venueObj.workingDays && venueObj.workingDays.length > 0) {
    if (!venueObj.workingDays.includes(bookingDay)) {
      return next(
        new AppError("عذراً، النادي مغلق في هذا اليوم من الأسبوع.", 400),
      );
    }
  }

  // التأكد من أن وقت الحجز يقع ضمن ساعات العمل
  const openHour = parseInt((venueObj.openTime || "08:00").split(":")[0], 10);
  const closeHour = parseInt((venueObj.closeTime || "04:00").split(":")[0], 10);
  const startHour = newStart.getHours();
  const endHour =
    newEnd.getHours() === 0 && newEnd.getMinutes() === 0
      ? 24
      : newEnd.getHours(); // معالجة منتصف الليل

  let isWithinWorkingHours = false;

  if (closeHour > openHour) {
    // النادي يفتح ويغلق في نفس اليوم (مثال: من 8 صباحاً إلى 10 مساءً)
    isWithinWorkingHours = startHour >= openHour && endHour <= closeHour;
  } else {
    // النادي يعمل متجاوزاً منتصف الليل (مثال: من 8 صباحاً إلى 4 فجراً من اليوم التالي)
    // الحجز مسموح إذا كان بعد وقت الفتح في نفس اليوم، أو قبل وقت الإغلاق في اليوم التالي
    isWithinWorkingHours = startHour >= openHour || endHour <= closeHour;
  }

  if (!isWithinWorkingHours && venueObj.operatingHours !== 24) {
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

  const bookingHour = newStart.getHours();
  const eveningStartHour = parseInt(
    (venueObj.eveningStartTime || "18:00").split(":")[0],
    10,
  );
  const morningStartHour = parseInt(
    (venueObj.openTime || "08:00").split(":")[0],
    10,
  );

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
    const currentHour = currentTempTime.getHours();
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
          { sort: { lastUsedAt: 1 }, new: true },
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
  } else if (req.query.venue) {
    filter.venue = req.query.venue;
  }

  if (req.query.court) filter.court = req.query.court;
  if (req.query.status) filter.status = req.query.status;

  let startOfLogicalDay, endOfLogicalDay;

  // إعدادات الـ Pagination
  const page = parseInt(req.query.page, 10) || 1;
  // السماح بـ limit أعلى في حالة عرض تقويم يوم كامل لتجنب اختفاء حجوزات من التقويم
  const defaultLimit = req.query.date ? 500 : 50;
  const limit = parseInt(req.query.limit, 10) || defaultLimit;
  const skip = (page - 1) * limit;

  if (req.query.date) {
    startOfLogicalDay = new Date(req.query.date);
    startOfLogicalDay.setHours(8, 0, 0, 0);

    endOfLogicalDay = new Date(req.query.date);
    endOfLogicalDay.setDate(endOfLogicalDay.getDate() + 1);
    endOfLogicalDay.setHours(7, 59, 59, 999);

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
    processedBookings = await Promise.all(
      processedBookings.map(async (b) => {
        const isMyBooking = b.user && b.user._id.toString() === req.user.id;

        if (!isMyBooking) {
          delete b.user;
          delete b.guestData;
          delete b.notes;
        } else if (
          b.status === "pending_payment" &&
          b.paymentMethod !== "cash"
        ) {
          const payment = await Payment.findOne({
            booking: b._id,
            status: { $in: ["pending", "pending_verification"] },
          });

          if (payment) {
            b.paymentId = payment._id;
            b.actualPaymentStatus = payment.status;
          }
        }
        return b;
      }),
    );
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

  if (
    req.user.role === "customer" &&
    booking.user?.toString() !== req.user.id
  ) {
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

  booking.status = "cancelled";
  booking.cancelledBy = req.user.id;
  await booking.save();

  res.status(200).json({
    status: "success",
    message: "تم إلغاء الحجز بنجاح",
    data: { booking },
  });
});

exports.updatePayment = catchAsync(async (req, res, next) => {
  const { paymentStatus, paymentMethod, deposit } = req.body;

  if (!paymentStatus && deposit === undefined)
    return next(
      new AppError("يرجى تحديد حالة الدفع الجديدة أو العربون المحدث", 400),
    );

  const booking = await Booking.findById(req.params.id).populate("venue");
  if (!booking) return next(new AppError("لا يوجد حجز بهذا المعرف", 404));

  // +++ التعديل الأمني الحاسم: منع تكرار الدفع (Double Click) +++
  if (booking.paymentStatus === "paid") {
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

  // حفظ العربون القديم قبل التحديث لمعرفة الفارق
  const oldDeposit = booking.deposit || 0;

  if (paymentStatus) booking.paymentStatus = paymentStatus;
  if (paymentMethod)
    booking.paymentMethod = paymentMethod || booking.paymentMethod;
  if (deposit !== undefined) booking.deposit = deposit;

  await booking.save();

  // إنشاء فاتورة كاش جديدة بالمبلغ المتبقي بدلاً من تغيير القديمة
  if (deposit !== undefined && deposit > oldDeposit) {
    const difference = deposit - oldDeposit; // قيمة المبلغ الذي دُفع في الملعب (الكاش)

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
      expiresAt: new Date(), // عملية منتهية ومؤكدة فوراً
    });
  }

  res.status(200).json({
    status: "success",
    message: "تم تحديث بيانات الدفع وتوثيق تحصيل الكاش بنجاح",
    data: { booking },
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
      if (startTimeHour < 8) {
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
