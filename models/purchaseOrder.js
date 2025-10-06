const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema(
  {
    purchaseOrderNo: {
      type: String,
      required: [true, "Purchase order number is required"],
      unique: true,
      trim: true,
    },
    materialRequestNo: {
      type: String,
      required: [true, "Material request number is required"],
      trim: true,
    },
    billTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: [true, "Bill to site is required"],
    },
    shipTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: [true, "Ship to site is required"],
    },
    deliveryDate: {
      type: Date,
      required: [true, "Delivery date is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
    },
    items: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
          required: true,
        },
        itemCode: { type: String, required: true },
        category: { type: String, required: true },
        description: { type: String, required: true },
        uom: { type: String, required: true },
        requestedQty: { type: Number, required: true },
        purchaseQty: { type: Number, required: true },
        receivedQty: { type: Number, default: 0 },
        pendingQty: { type: Number, default: function() { return this.purchaseQty; } },
        status: { type: String, enum: ["Pending", "partially received", "Completed"], default: "Pending" },
        supplier: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Supplier",
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    igst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    grandTotalIncGST: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Closed", "partially received", "Completed"],
      default: "Pending",
    },
    pdfLink: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Pre-save middleware to calculate pendingQty
purchaseOrderSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      if (item.pendingQty === undefined || item.pendingQty === null) {
        item.pendingQty = item.purchaseQty - (item.receivedQty || 0);
      }
    });
  }
  next();
});

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);