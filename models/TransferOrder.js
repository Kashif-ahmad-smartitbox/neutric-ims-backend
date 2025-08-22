const mongoose = require("mongoose");

const transferOrderSchema = new mongoose.Schema(
  {
    transferNo: { type: String, required: true, unique: true },

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
  },
  { timestamps: true }
);

module.exports = mongoose.model("transferOrder", transferOrderSchema);
