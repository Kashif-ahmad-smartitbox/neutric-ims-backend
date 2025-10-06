const mongoose = require("mongoose");

const materialInwardSchema = new mongoose.Schema(
  {
    grnNo: {
      type: String,
      required: [true, "GRN number is required"],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Transferred", "Supplied"],
      required: [true, "GRN type is required"],
    },
    subType: {
      type: String,
      enum: ["Challan", "Invoice", ""],
      default: "",
    },
    materialIssueNo: {
      type: String,
      trim: true,
      default: "",
    },
    purchaseOrderNo: {
      type: String,
      trim: true,
      default: "",
    },
    transferNo: {
      type: String,
      trim: true,
      default: "",
    },
    vehicleNo: {
      type: String,
      trim: true,
      default: "",
    },
    exitDateTime: {
      type: Date,
      default: null,
    },
    challanNo: {
      type: String,
      trim: true,
      default: "",
    },
    challanDate: {
      type: Date,
      default: null,
    },
    invoiceNo: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceDate: {
      type: Date,
      default: null,
    },
    receivedBy: {
      type: String,
      required: [true, "Received by is required"],
      trim: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
    },
    supplierName: {
      type: String,
      trim: true,
      default: "",
    },
    items: [
      {
        itemCode: {
          type: String,
          required: [true, "Item code is required"],
          trim: true,
        },
        category: {
          type: String,
          required: [true, "Category is required"],
          trim: true,
        },
        description: {
          type: String,
          required: [true, "Description is required"],
          trim: true,
        },
        uom: {
          type: String,
          required: [true, "Unit of measure is required"],
          trim: true,
        },
        balanceQty: {
          type: Number,
          required: [true, "Balance quantity is required"],
          min: 0,
        },
        receiveQty: {
          type: Number,
          required: [true, "Receive quantity is required"],
          min: 0,
        },
        pendingQty: {
          type: Number,
          required: [true, "Pending quantity is required"],
          min: 0,
        },
        supplier: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Supplier",
          required: false, // Optional for backward compatibility
        },
      },
    ],
    pdfLink: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Index for faster queries on grnNo
materialInwardSchema.index({ grnNo: 1 });

module.exports = mongoose.model("MaterialInward", materialInwardSchema);