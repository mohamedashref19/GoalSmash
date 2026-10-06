const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const { Server } = require("socket.io");

// Sentry لازم يبدأ بعد dotenv (عشان يقرأ SENTRY_DSN) وقبل باقي الموديولات
const Sentry = require("@sentry/node");
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "production",
});

const mongoose = require("mongoose");
const http = require("http");

const startExpirationJob = require("./services/expirationService");
//const startKeepAliveJob = require("./services/keepAliveService");

const app = require("./app");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: app.get("allowedOrigins"),
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  },
});

// تفعيل السوكت الحقيقي وإتاحته للكنترولرز
app.set("io", io);

const DB = process.env.DATABASE;
mongoose
  .connect(DB, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log("DB connection successful!");
    startExpirationJob();
  })
  .catch((err) => {
    // السيرفر من غير داتابيز مالوش لازمة: نطلع وPM2 يعيد التشغيل
    console.error("DB connection error:", err);
    Sentry.captureException(err);
    Sentry.flush(2000).finally(() => process.exit(1));
  });

const port = process.env.PORT || 3000;
// نسمع على localhost بس: Nginx هو الوحيد اللي يوصل للـ API من بره.
// قبل كده كان على كل الواجهات (*:3000)، يعني لو الـ Security Group فاتح 3000
// الـ API يتوصل له مباشرة ويتخطى Nginx والـ rate limit (عن طريق X-Forwarded-For مزيف).
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => {
  console.log(`App running on ${host}:${port}... `);
});

//startKeepAliveJob();

// ---------- معالجة الأخطاء على مستوى العملية ----------
process.on("unhandledRejection", (reason) => {
  // غالباً من jobs في الخلفية: نسجل ونبلّغ من غير ما نوقع السيرفر
  console.error("Unhandled Rejection:", reason);
  Sentry.captureException(reason);
});

process.on("uncaughtException", (err) => {
  // الحالة بعد uncaughtException مش مضمونة، فنبلّغ ونطلع وPM2 يرجّعه
  console.error("Uncaught Exception:", err);
  Sentry.captureException(err);
  Sentry.flush(2000).finally(() => process.exit(1));
});

// ---------- إيقاف هادي (pm2 restart بيبعت SIGINT) ----------
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: shutting down gracefully...`);

  // لو اتعلّق، نطلع بالقوة بعد 10 ثواني
  setTimeout(() => process.exit(1), 10000).unref();

  server.close(() => {
    mongoose.connection
      .close()
      .catch((err) => console.error("Error closing DB:", err))
      .finally(() => process.exit(0));
  });
  // نقفل الاتصالات الخاملة عشان server.close ماتستناش keep-alive
  server.closeIdleConnections?.();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
