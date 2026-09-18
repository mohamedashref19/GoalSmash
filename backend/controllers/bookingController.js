const mongoose = require("mongoose");
const { Mutex } = require("async-mutex");
const Booking = require("../models/bookingModel");
const Payment = require("../models/paymentModel");
const Court = require("../models/courtModel");
const Venue = require("../models/venueModel");
const Notification = require("../models/notificationModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

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

  if (req.user && req.user.role === "owner") {
    const venueObj = await Venue.findById(venue);
    if (!venueObj || venueObj.owner.toString() !== req.user.id) {
      return next(new AppError("غير مصرح لك بإنشاء حجز في هذا الملعب!", 403));
    }
  }

  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);

  if (newStart >= newEnd)
    return next(new AppError("وقت النهاية يجب أن يكون بعد وقت البداية", 400));
  if (newStart < new Date())
    return next(new AppError("لا يمكنك إنشاء حجز في وقت مضى", 400));

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
      new AppError(
        "يرجى اختيار طريقة دفع صحيحة (فودافون كاش أو انستاباي)",
        400,
      ),
    );
  }

  const courtExists = await Court.findById(court);
  if (!courtExists) return next(new AppError("هذا الملعب غير موجود", 404));

  const durationInHours =
    (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);
  const calculatedTotalPrice = Number(
    (durationInHours * courtExists.pricePerHour).toFixed(2),
  );

  if (!Number.isFinite(calculatedTotalPrice) || calculatedTotalPrice <= 0) {
    return next(new AppError("تعذر حساب السعر الإجمالي بشكل صحيح", 400));
  }

  // +++ حساب نسبة وقيمة العمولة ديناميكياً +++
  const commissionRate = durationInHours >= 2 ? 0.1 : 0.05; // 10% لساعتين فأكثر، و 5% لأقل من ذلك
  const calculatedCommission = Number(
    (calculatedTotalPrice * commissionRate).toFixed(2),
  );

  const courtIdString = court.toString();
  const mutex = getCourtMutex(courtIdString);

  await mutex.runExclusive(async () => {
    const conflictingBooking = await Booking.findOne({
      court: court,
      status: { $in: ["confirmed", "pending_payment"] },
      $and: [{ startTime: { $lt: newEnd } }, { endTime: { $gt: newStart } }],
    });

    if (conflictingBooking) {
      throw new AppError(
        "عذراً، هذا الملعب محجوز بالفعل أو في انتظار الدفع",
        409,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() + 10);

      let bookingData = {
        venue,
        court,
        startTime: newStart,
        endTime: newEnd,
        bookingType,
        totalPrice: calculatedTotalPrice,
        commission: calculatedCommission, // +++ حفظ قيمة العمولة المحسوبة للحجز +++
        deposit: calculatedTotalPrice,
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
        const expectedAmount = await generateUniqueAmount(calculatedTotalPrice);
        const reference = `PAY-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const [createdPayment] = await Payment.create(
          [
            {
              booking: newBooking._id,
              paymentReference: reference,
              method: paymentMethod,
              baseAmount: calculatedTotalPrice,
              expectedAmount: expectedAmount,
              expiresAt: expirationTime,
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
              amountReceived:
                req.body.deposit !== undefined
                  ? req.body.deposit
                  : calculatedTotalPrice,
              status: "verified",
              verifiedAt: new Date(),
              verificationMethod: "admin",
              verificationNotes: "حجز يدوي من لوحة الإدارة",
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
          const venueObj = await Venue.findById(venue);
          const bookingDate = newStart.toLocaleDateString("ar-EG");
          const bookingTime = newStart.toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const io = req.app.get("io");

          if (venueObj && venueObj.owner) {
            const customerName = guestData?.name || "عميل";
            const ownerMessage = `قام ${customerName} (حجز يدوي) بحجز ملعب ${courtExists.name} في ${venueObj.name} يوم ${bookingDate} الساعة ${bookingTime}.`;
            const ownerNotification = await Notification.create({
              recipient: venueObj.owner,
              title: "حجز يدوي جديد 📅",
              message: ownerMessage,
              type: "booking",
              relatedId: newBooking._id,
            });
            if (io)
              io.emit(`notification-${venueObj.owner}`, ownerNotification);
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
          instructions: {
            vodafoneCashNumber:
              process.env.VODAFONE_CASH_NUMBER || "01000000000",
            instaPayAddress: process.env.INSTAPAY_ADDRESS || "nadi@instapay",
          },
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

  if (req.user && req.user.role === "customer") {
    if (!req.query.venue && !req.query.court) {
      filter.user = req.user.id;
    }
  }

  // +++ قفل الأمان 2: إجبار المالك على رؤية حجوزات ملاعبه فقط +++
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

  if (req.query.date) {
    const startOfLogicalDay = new Date(req.query.date);
    startOfLogicalDay.setHours(8, 0, 0, 0);

    const endOfLogicalDay = new Date(req.query.date);
    endOfLogicalDay.setDate(endOfLogicalDay.getDate() + 1);
    endOfLogicalDay.setHours(7, 59, 59, 999);

    filter.startTime = { $gte: startOfLogicalDay, $lte: endOfLogicalDay };
  }

  const bookings = await Booking.find(filter)
    .populate({ path: "venue", select: "name address" })
    .populate({ path: "court", select: "name sportType pricePerHour" })
    .populate({ path: "user", select: "name phone" })
    .sort("startTime");

  let processedBookings = bookings;

  if (req.user && req.user.role === "customer") {
    processedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const b = booking.toObject();
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

  res.status(200).json({
    status: "success",
    results: processedBookings.length,
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

  // +++ قفل الأمان 3: التأكد من صلاحية المالك لرؤية حجز محدد +++
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
  await booking.save();

  res.status(200).json({
    status: "success",
    message: "تم إلغاء الحجز بنجاح",
    data: { booking },
  });
});

exports.updatePayment = catchAsync(async (req, res, next) => {
  const { paymentStatus, paymentMethod } = req.body;
  if (!paymentStatus)
    return next(new AppError("يرجى تحديد حالة الدفع الجديدة", 400));

  // +++ قفل الأمان 4: منع أي مالك من تعديل دفع لحجز في ملعب لا يملكه +++
  const booking = await Booking.findById(req.params.id).populate("venue");
  if (!booking) return next(new AppError("لا يوجد حجز بهذا المعرف", 404));

  if (
    req.user.role === "owner" &&
    booking.venue &&
    booking.venue.owner &&
    booking.venue.owner.toString() !== req.user.id
  ) {
    return next(new AppError("ليس لديك صلاحية لتعديل دفع هذا الحجز", 403));
  }

  booking.paymentStatus = paymentStatus;
  booking.paymentMethod = paymentMethod || booking.paymentMethod;
  await booking.save();

  res.status(200).json({
    status: "success",
    message: "تم تحديث بيانات الدفع بنجاح",
    data: { booking },
  });
});
