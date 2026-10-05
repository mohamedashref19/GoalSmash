const multer = require("multer");
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const AppError = require("./appError");
const path = require("path");

// 1. إعداد اتصال Cloudflare R2
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

// 2. استلام الصورة في الذاكرة المؤقتة
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [".png", ".jpg", ".jpeg", ".webp"];

  const isAllowedExt = allowedExts.includes(ext);
  const isAllowedMime = file.mimetype.startsWith("image/");

  if (isAllowedExt && isAllowedMime) {
    cb(null, true);
  } else {
    cb(
      new AppError("غير مسموح! يرجى رفع صور فقط بصيغ (JPG, PNG, WEBP).", 400),
      false,
    );
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.uploadVenueImage = upload.single("image");

// 3. Middleware معالجة الصورة أمنياً ورفعها لمجلد الملاعب في Cloudflare R2
exports.processAndUploadImage = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const filename = `venue-${req.user?.id || "admin"}-${Date.now()}.webp`;

    // +++ التعديل هنا: تحديد مجلد venues/ +++
    const s3Key = `venues/${filename}`;

    const processedImageBuffer = await sharp(req.file.buffer)
      .resize(1200, 800, { fit: "inside", withoutEnlargement: true })
      .toFormat("webp")
      .webp({ quality: 80 })
      .toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: s3Key, // رفع الصورة داخل مجلد venues
        Body: processedImageBuffer,
        ContentType: "image/webp",
      }),
    );

    // +++ التعديل هنا: الرابط النهائي هيشمل مسار المجلد +++
    req.file.path = `${process.env.R2_PUBLIC_URL}/${s3Key}`;

    next();
  } catch (err) {
    console.error("Image Upload Error:", err);
    return next(new AppError("حدث خطأ أثناء معالجة ورفع الصورة", 500));
  }
};

// ==========================================
// +++ دالة إضافية لرفع إيصالات الدفع (للمستقبل) +++
// ==========================================
exports.uploadPaymentProofImage = upload.single("proofImage");

exports.processAndUploadPaymentProof = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const filename = `payment-${req.user?.id || "guest"}-${Date.now()}.webp`;
    const s3Key = `payments/${filename}`; // الرفع داخل مجلد payments عشان يتمسح تلقائياً

    const processedImageBuffer = await sharp(req.file.buffer)
      .resize(800, 1200, { fit: "inside", withoutEnlargement: true }) // إيصالات الدفع غالباً بالطول
      .toFormat("webp")
      .webp({ quality: 70 }) // ضغط أعلى شوية لأن الجودة العالية مش مطلوبة هنا
      .toBuffer();

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: s3Key,
        Body: processedImageBuffer,
        ContentType: "image/webp",
      }),
    );

    req.file.path = `${process.env.R2_PUBLIC_URL}/${s3Key}`;

    next();
  } catch (err) {
    console.error("Payment Proof Upload Error:", err);
    return next(new AppError("حدث خطأ أثناء معالجة إثبات الدفع", 500));
  }
};
