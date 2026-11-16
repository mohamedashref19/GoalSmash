const mongoose = require("mongoose");

const venueRequestSchema = new mongoose.Schema(
  {
    venueName: {
      type: String,
      required: [true, "يرجى إدخال اسم الملعب أو النادي"],
      trim: true,
    },
    area: {
      type: String,
      required: [true, "يرجى إدخال المنطقة"],
      trim: true,
    },
    venuePhone: {
      type: String,
      trim: true,
      default: "",
    },
    requesterRole: {
      type: String,
      enum: ["player", "owner"],
      default: "player",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "contacted", "added"],
      default: "pending",
    },
    submittedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    submitterName: {
      type: String,
      default: "",
    },
    submitterPhone: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

const VenueRequest = mongoose.model("VenueRequest", venueRequestSchema);

module.exports = VenueRequest;
