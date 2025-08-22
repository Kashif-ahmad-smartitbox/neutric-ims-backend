const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema(
  {
    purchaseOrderno: { type: String, required: true, unique: true },
    materialRequestNo: { type: String, required: true },
    SupplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    billTo: {
      type: String,
      required: true,
    },
    shipTo: {
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
        purchaseQty: { type: Number, required: true },
        price: { type: Number },
        gst: { type: Number },
        total: { type: Number },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },
    deliveryDate: {
      type: Date,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
