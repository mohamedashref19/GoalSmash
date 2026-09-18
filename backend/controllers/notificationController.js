const Notification = require("../models/notificationModel");

exports.getMyNotifications = async (req, res, next) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });

  res.status(200).json({
    status: "success",
    unreadCount,
    data: { notifications },
  });
};

exports.markAsRead = async (req, res, next) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.status(200).json({ status: "success" });
};

exports.markAllAsRead = async (req, res, next) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true },
  );
  res.status(200).json({ status: "success" });
};
