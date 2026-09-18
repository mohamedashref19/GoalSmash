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

const app = express();

app.set("trust proxy", 1);

//Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(cors());

// Rate limiting
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);

//Dev Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

//  Body Parser
app.use(express.json({ limit: "10kb" }));

// sanitizes input
// app.use(mongoSanitize());
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  if (req.headers) mongoSanitize.sanitize(req.headers);
  next();
});

app.use(hpp());

// cookie parser
app.use(cookieParser(process.env.JWT_COOKIE_SECRET));

app.use(express.static(path.join(__dirname, "public")));

//  Routes
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
// Undefined Routes
app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);
module.exports = app;
