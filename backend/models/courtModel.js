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
      default:
        "https://www.emys.gov.eg/uploads/photos/2025/09/68d583233614a_1758823203.jpg",
    },
    sportType: {
      type: String,
      enum: {
        values: ["padel", "football"],
        message: "نوع الرياضة يجب أن يكون padel أو football فقط",
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
    pricePerHour: {
      type: Number,
      required: [true, "يرجى تحديد سعر الحجز في الساعة للملعب"],
    },
  },
  {
    timestamps: true,
  },
);

courtSchema.pre(/^find/, function () {
  this.populate({
    path: "venue",
    select: "name address phone",
  });
});

const Court = mongoose.model("Court", courtSchema);

module.exports = Court;
