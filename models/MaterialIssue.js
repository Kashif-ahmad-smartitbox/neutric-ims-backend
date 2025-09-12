const mongoose = require("mongoose");

const materialIssueSchema = new mongoose.Schema(
  {
    items: [
      {
        _id: false,
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
          required: true,
        },
        issueQty: { type: Number, required: true },
      },
    ],

    materialIssueNumber: {
      type: String,
      unique: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issuedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
    shipmentDetails: {
      transferNo: {
        type: String,
        trim: true,
      },
      vehicleNo: {
        type: String,
        trim: true,
      },
      dateAndExitTime: {
        type: Date,
      },
      destination: {
        type: String,
        trim: true,
      },
      materialInwardStatus:{
        type: String,
        enum: ["pending", "approved", 'partially received'],
        default: "pending",
      },

      transferOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TransferOrder",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MaterialIssue", materialIssueSchema);
