const mongoose = require("mongoose");

const courtSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "يرجى إدخال اسم أو رقم الملعب (مثل: بادل 1)"],
      trim: true,
    },
    image: {
      type: String,
      default: "https://mla3balexandria-api.online/assets/logo.png",
    },
    images: {
      type: [String],
      default: [],
    },
    locationUrl: {
      type: String,
      trim: true,
      default: "",
    },
    sportType: {
      type: String,
      enum: {
        values: ["padel", "football", "football_7"],
        message: "نوع الرياضة يجب أن يكون padel أو football فقط أو football_7",
      },
      required: [true, "يرجى تحديد نوع الرياضة للملعب"],
    },
    venue: {
      type: mongoose.Schema.ObjectId,
      ref: "Venue",
      required: [true, "الملعب يجب أن يكون مرتبطاً بمكان/مجمع"],
    },
    status: {
      type: String,
      enum: {
        values: ["active", "maintenance", "inactive"],
        message: "حالة الملعب غير صحيحة",
      },
      default: "active",
    },
    priceMorning: {
      type: Number,
      required: [true, "يرجى تحديد سعر الحجز الصباحي للملعب"],
      min: [0, "السعر لا يمكن أن يكون سالباً"],
    },
    priceEvening: {
      type: Number,
      required: [true, "يرجى تحديد سعر الحجز المسائي للملعب"],
      min: [0, "السعر لا يمكن أن يكون سالباً"],
    },
  },
  {
    timestamps: true,
  },
);

courtSchema.pre(/^find/, function () {
  this.find({ status: { $ne: "inactive" } });
  this.populate({
    path: "venue",
    select: "name address phone eveningStartTime openTime locationUrl",
  });
});

const Court = mongoose.model("Court", courtSchema);

module.exports = Court;
