const PaymentAccount = require("../models/paymentAccountModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// 1. دوال الإدارة (SUDO / Admin)

// جلب كل الحسابات (لعرضها في لوحة التحكم)
exports.getAllAccounts = catchAsync(async (req, res, next) => {
  const accounts = await PaymentAccount.find().sort("-createdAt");
  res.status(200).json({
    status: "success",
    results: accounts.length,
    data: { accounts },
  });
});

// إضافة حساب جديد
exports.createAccount = catchAsync(async (req, res, next) => {
  const newAccount = await PaymentAccount.create(req.body);
  res.status(201).json({
    status: "success",
    message: "تمت إضافة الحساب بنجاح",
    data: { account: newAccount },
  });
});

// تعديل حالة الحساب (تفعيل / إيقاف)
exports.toggleAccountStatus = catchAsync(async (req, res, next) => {
  const account = await PaymentAccount.findById(req.params.id);
  if (!account) return next(new AppError("الحساب غير موجود", 404));

  account.isActive = !account.isActive;
  await account.save();

  res.status(200).json({
    status: "success",
    message: account.isActive ? "تم تفعيل الحساب" : "تم إيقاف الحساب",
    data: { account },
  });
});

// تعديل بيانات الحساب (تغيير الاسم أو الرقم)
exports.updateAccount = catchAsync(async (req, res, next) => {
  const account = await PaymentAccount.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!account) return next(new AppError("الحساب غير موجود", 404));

  res.status(200).json({
    status: "success",
    message: "تم تحديث البيانات بنجاح",
    data: { account },
  });
});

// حذف حساب
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const account = await PaymentAccount.findByIdAndDelete(req.params.id);
  if (!account) return next(new AppError("الحساب غير موجود", 404));

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// 2. دالة العميل (التحويل الديناميكي الذكي)

// اختيار حساب دفع متاح وعرضه للعميل
exports.getAvailablePaymentAccount = catchAsync(async (req, res, next) => {
  const { type } = req.query; // 'vodafone_cash' أو 'instapay'

  if (!type || !["vodafone_cash", "instapay"].includes(type)) {
    return next(new AppError("يجب تحديد نوع الحساب المطلوب بشكل صحيح", 400));
  }

  // البحث عن الحسابات النشطة من نفس النوع وترتيبها من الأقدم للأحدث استخداماً
  const account = await PaymentAccount.findOneAndUpdate(
    { type, isActive: true },
    { lastUsedAt: new Date() }, // تحديث تاريخ الاستخدام فور اختياره
    { sort: { lastUsedAt: 1 }, new: true }, // 1 تعني تصاعدي (الأقدم أولاً)
  );

  if (!account) {
    return next(
      new AppError(
        `عذراً، لا يوجد حسابات ${type} متاحة حالياً. يرجى المحاولة لاحقاً.`,
        404,
      ),
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      account: {
        identifier: account.identifier,
        accountName: account.accountName,
        type: account.type,
      },
    },
  });
});
