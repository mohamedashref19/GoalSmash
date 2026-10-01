const mongoose = require("mongoose");

const dailySettlementSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.ObjectId,
      ref: "Venue",
      required: true,
    },
    dateString: {
      type: String,
      required: true, // صيغة YYYY-MM-DD
    },
    isSettled: {
      type: Boolean,
      default: false,
    },
    settledBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// منع التكرار لنفس النادي في نفس اليوم
dailySettlementSchema.index({ venue: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model("DailySettlement", dailySettlementSchema);
