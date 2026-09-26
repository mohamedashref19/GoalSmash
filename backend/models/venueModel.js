const mongoose = require("mongoose");

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "يرجى إدخال اسم المكان/المجمع الرياضي"],
      trim: true,
    },
    image: {
      type: String,
      default:
        "https://www.emys.gov.eg/uploads/photos/2025/09/68d583233614a_1758823203.jpg",
    },
    phone: {
      type: String,
      required: [true, "يرجى إدخال رقم هاتف للتواصل مع المكان"],
    },
    openTime: {
      type: String,
      default: "08:00",
    },
    closeTime: {
      type: String,
      default: "04:00",
    },
    operatingHours: {
      type: Number,
      default: 24,
    },
    // +++ الحقل الجديد لتحديد بداية الفترة المسائية +++
    eveningStartTime: {
      type: String,
      default: "18:00", // الافتراضي 6 مساءً
    },
    address: {
      city: {
        type: String,
        required: [true, "يرجى تحديد المدينة"],
      },
      area: {
        type: String,
        required: [true, "يرجى تحديد المنطقة"],
      },
      details: String,
    },
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "المكان يجب أن يكون مرتبطاً بمالك "],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

venueSchema.virtual("courts", {
  ref: "Court",
  foreignField: "venue",
  localField: "_id",
});
venueSchema.pre(/^find/, function () {
  this.find({ isActive: { $ne: false } });
});

const Venue = mongoose.model("Venue", venueSchema);
module.exports = Venue;
