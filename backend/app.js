// Modules
const hpp = require("hpp");
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const Sentry = require("@sentry/node");

// utils
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");

const userRouter = require("./routes/userRoutes");
const venueRoutes = require("./routes/venueRoutes");
const courtRoutes = require("./routes/courtRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const dashboardRouter = require("./routes/dashboardRoutes");
const notificationRouter = require("./routes/notificationRoutes");
const paymentRouter = require("./routes/paymentRoutes");
const adminRouter = require("./routes/adminRoutes");
const reviewRoutes = require("./routes/reviewRoutes");

const app = express();

// مهم: خليها 1 بس لو فيه Nginx/Cloudflare قدام Node.
app.set("trust proxy", 1);

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// CORS for Web and Mobile (Capacitor)
// قايمة واحدة بتتشارك مع socket.io في server.js
const allowedOrigins = [
  process.env.FRONTEND_URL?.replace(/\/$/, ""),
  "http://localhost:8081",
  "http://localhost",
  "https://localhost", // Capacitor الحديث على أندرويد
  "capacitor://localhost",
].filter(Boolean);
app.set("allowedOrigins", allowedOrigins);

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ---------- Rate limiting ----------
const limitMessage = (message) => ({ status: "fail", message });

// عام: أوسع شوية عشان شبكات الموبايل بتشارك IP بين ناس كتير
const limiter = rateLimit({
  max: 500,
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("طلبات كثيرة جداً، يرجى المحاولة بعد قليل"),
});
app.use("/api", limiter);

// تسجيل الدخول: بنعدّ المحاولات الفاشلة بس، عشان الناجحين مايتقفلوش على بعض
const loginLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage(
    "محاولات تسجيل دخول كثيرة جداً، يرجى المحاولة بعد 15 دقيقة",
  ),
});
app.use("/api/v1/users/login", loginLimiter);

// التسجيل / OTP / نسيت الباسورد / إعادة التعيين: بيبعتوا إيميلات وبيتخمّن فيهم
// بنطابق على اسم المسار عشان يشتغل مهما كانت تسمية الـ routes عندك
const sensitiveLimiter = rateLimit({
  max: 20,
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage("محاولات كثيرة جداً، يرجى المحاولة بعد 15 دقيقة"),
});
const sensitivePath =
  /(signup|register|otp|verify|forget|forgot|reset|resend)/i;
app.use("/api/v1/users", (req, res, next) =>
  sensitivePath.test(req.path) ? sensitiveLimiter(req, res, next) : next(),
);

// Dev Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// SMS webhook body parser
app.use(
  "/api/v1/payments/webhook/sms",
  express.text({ type: "*/*", limit: "10kb" }),
  (req, res, next) => {
    if (typeof req.body === "string") {
      try {
        const cleaned = req.body.replace(/[\u0000-\u001F]+/g, " ");
        req.body = JSON.parse(cleaned);
      } catch (err) {
        return next(new AppError("Invalid JSON body", 400));
      }
    }
    next();
  },
);

// Body Parser
app.use(express.json({ limit: "10kb" }));

// NoSQL injection sanitization (متوافق مع Express 5؛ لا تستخدم app.use(mongoSanitize()) العادية)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: "_" });
  if (req.params) mongoSanitize.sanitize(req.params, { replaceWith: "_" });
  if (req.query) mongoSanitize.sanitize(req.query, { replaceWith: "_" });
  next();
});

app.use(hpp());

// cookie parser
app.use(cookieParser(process.env.JWT_COOKIE_SECRET));

// Static files (تأكد إن مفيش أي ملف حساس جوه فولدر public)
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.status(200).send("Mla3bAlexandria API is running successfully! 🚀");
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/venues", venueRoutes);
app.use("/api/v1/courts", courtRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/review", reviewRoutes);

// Undefined Routes
app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);
module.exports = app;
