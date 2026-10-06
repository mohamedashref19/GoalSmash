const Notification = require("../models/notificationModel");
const catchAsync = require("../utils/catchAsync");

exports.getMyNotifications = catchAsync(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100); // 20 إشعار في الصفحة
  const skip = (page - 1) * limit;

  const totalDocuments = await Notification.countDocuments({
    recipient: req.user._id,
  });
  const totalPages = Math.ceil(totalDocuments / limit);

  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  res.status(200).json({
    status: "success",
    unreadCount,
    results: notifications.length,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalDocuments,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { notifications },
  });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
  // لازم الإشعار يكون بتاع المستخدم نفسه: قبل كده أي مستخدم كان يقدر يعلّم إشعار غيره
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
  );
  res.status(200).json({ status: "success" });
});

exports.markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true },
  );
  res.status(200).json({ status: "success" });
});
