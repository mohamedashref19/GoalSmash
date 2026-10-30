// بيبعت حدث لغرفة مستخدم واحد بس (user:<id>) بدل io.emit اللي بيوصل لكل المتصلين.
// السوكت بيدخل غرفته بعد تحقق التوكن في server.js.
exports.emitToUser = (io, userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};
