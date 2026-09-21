const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");
const AppError = require("./appError");

const multerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    return {
      folder: "goalsmash/venues",
      public_id: `venue-${req.user.id}-${Date.now()}`,
      // Cloudinary بيحدد النوع (jpeg/png/etc) تلقائيًا من الملف نفسه
      resource_type: "image",
    };
  },
});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("يرجى رفع صور فقط!", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadVenueImage = upload.single("image");
