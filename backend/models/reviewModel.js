const mongoose = require("mongoose");
const Venue = require("./venueModel");

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "التقييم مطلوب"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    venue: {
      type: mongoose.Schema.ObjectId,
      ref: "Venue",
      required: [true, "يجب أن ينتمي التقييم إلى نادي/ملعب."],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "يجب أن ينتمي التقييم إلى مستخدم."],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// منع المستخدم من تقييم نفس الملعب أكتر من مرة
reviewSchema.index({ venue: 1, user: 1 }, { unique: true });

// دالة لحساب متوسط التقييمات وحفظها في النادي
reviewSchema.statics.calcAverageRatings = async function (venueId) {
  const stats = await this.aggregate([
    { $match: { venue: venueId } },
    {
      $group: {
        _id: "$venue",
        nRating: { $sum: 1 },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  if (stats.length > 0) {
    await Venue.findByIdAndUpdate(venueId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: Math.round(stats[0].avgRating * 10) / 10,
    });
  } else {
    await Venue.findByIdAndUpdate(venueId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5, // القيمة الافتراضية
    });
  }
};

reviewSchema.post("save", function () {
  this.constructor.calcAverageRatings(this.venue);
});

const Review = mongoose.model("Review", reviewSchema);
module.exports = Review;
