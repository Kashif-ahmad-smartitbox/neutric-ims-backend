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
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Site",
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
        requestedQty: { type: Number,  },
        purchaseQty: { type: Number,  },
        price: { type: Number,  },
        gst: { type: Number, },
        total: { type: Number,  },
      },
    ],

    totalAmount: { type: Number,},
    igst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    grandTotalIncGST: { type: Number, },

    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },

    deliveryDate: { type: Date },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
