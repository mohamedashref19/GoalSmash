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

// Virtual Populate

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
