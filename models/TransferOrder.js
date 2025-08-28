const mongoose = require("mongoose");

const transferOrderSchema = new mongoose.Schema(
  {
    transferNo: { type: String, required: true, unique: true },
    materialIssueNo: { type: String, },

    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },

    type: {
      type: String,
    },

    vehicleNumber: {
      type: String,
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    requestedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    exitDateTime: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("transferOrder", transferOrderSchema);
