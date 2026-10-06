const multer = require("multer");
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const AppError = require("./appError");
const path = require("path");

// sharp على سيرفر رامه صغيرة: نحدد الذاكرة والتوازي
sharp.concurrency(1);
sharp.cache({ memory: 50 });

// ملف 5MB ممكن يكون PNG بأبعاد عملاقة (decompression bomb) ويستهلك GB رام ويوقّع السيرفر.
// 25 ميجا بكسل يكفي صور الموبايل (6000×4000).
const MAX_INPUT_PIXELS = 25_000_000;

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
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 30,
    fieldSize: 10 * 1024,
  },
});

// معالجة الصورة (sharp) منفصلة عن الرفع: ملف تالف = خطأ 400 من العميل مش 500
const toWebp = async (buffer, width, height, quality) => {
  try {
    return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // تصحيح اتجاه صور الموبايل (الـ EXIF بيتشال بعد المعالجة)
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  } catch (err) {
    throw new AppError("الملف ليس صورة صالحة أو أبعاده كبيرة جداً", 400);
  }
};

const uploadToR2 = async (s3Key, body) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: s3Key,
      Body: body,
      ContentType: "image/webp",
    }),
  );
  return `${process.env.R2_PUBLIC_URL}/${s3Key}`;
};

exports.uploadVenueImage = upload.single("image");

// 3. Middleware معالجة الصورة أمنياً ورفعها لمجلد الملاعب في Cloudflare R2
exports.processAndUploadImage = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const filename = `venue-${req.user?.id || "admin"}-${Date.now()}.webp`;
    const s3Key = `venues/${filename}`;

    const buffer = await toWebp(req.file.buffer, 1200, 800, 80);
    req.file.path = await uploadToR2(s3Key, buffer);

    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
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

    // إيصالات الدفع غالباً بالطول، وضغط أعلى شوية لأن الجودة العالية مش مطلوبة
    const buffer = await toWebp(req.file.buffer, 800, 1200, 70);
    req.file.path = await uploadToR2(s3Key, buffer);

    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    console.error("Payment Proof Upload Error:", err);
    return next(new AppError("حدث خطأ أثناء معالجة إثبات الدفع", 500));
  }
};
