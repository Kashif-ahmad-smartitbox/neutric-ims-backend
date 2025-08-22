const mongoose = require("mongoose");

const materialRequestSchema = new mongoose.Schema(
  {
    materialRequestNo: { type: String, default: "" },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // requestedTo: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User",
    //   required: true,
    // },
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },

    items: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
          required: true,
        },
        requestedQty: { type: Number, required: true },
      },
    ],

    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaterialRequest", materialRequestSchema);
