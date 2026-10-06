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
      match: [/^([01]?\d|2[0-3]):[0-5]\d$/, "صيغة الوقت يجب أن تكون HH:MM"],
    },
    closeTime: {
      type: String,
      default: "04:00",
      match: [/^([01]?\d|2[0-3]):[0-5]\d$/, "صيغة الوقت يجب أن تكون HH:MM"],
    },
    operatingHours: {
      type: Number,
      default: 24,
    },
    //  الحقل الجديد لتحديد بداية الفترة المسائية
    eveningStartTime: {
      type: String,
      default: "18:00", // الافتراضي 6 مساءً
      match: [/^([01]?\d|2[0-3]):[0-5]\d$/, "صيغة الوقت يجب أن تكون HH:MM"],
    },
    //  ا (0 = الأحد، 1 = الإثنين ... 6 = السبت)
    workingDays: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6],
      validate: {
        validator: (days) =>
          days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: "أيام العمل يجب أن تكون أرقاماً من 0 إلى 6",
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, "التقييم يجب أن يكون أعلى من 1"],
      max: [5, "التقييم يجب أن يكون أقل من 5"],
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
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
