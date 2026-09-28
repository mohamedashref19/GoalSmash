const mongoose = require("mongoose");

const courtBlockSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.ObjectId,
      ref: "Venue",
      required: true,
    },
    court: {
      type: mongoose.Schema.ObjectId,
      ref: "Court",
      required: true,
    },
    blockType: {
      type: String,
      enum: ["maintenance", "academy"],
      default: "maintenance",
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    notes: String,
    recurrenceId: String,
  },
  { timestamps: true },
);

// فهرس لتسريع البحث عن التعارضات وجلب جدول الملاعب
courtBlockSchema.index({ court: 1, startTime: 1, endTime: 1 });

const CourtBlock = mongoose.model("CourtBlock", courtBlockSchema);
module.exports = CourtBlock;
