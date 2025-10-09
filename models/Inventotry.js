const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },
  open: {
    type: Number,
    trim: true,
    default: 0,
  },
  inHand: {
    type: Number,
    trim: true,
    default: 0,
  },
  requestQuantity: {
    type: Number,
    trim: true,
    default: 0,
  },
  issuedQuantity: {
    type: Number,
    default: 0,
  },
  mip: {
    type: Number,
    default: 0,
  },
  pending: {
    type: Number,
    default: 0,
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Site",
    default: null,
  }
   
}, { timestamps: true });

// Compound unique index on itemId and siteId to allow same item across different sites
inventorySchema.index({ itemId: 1, siteId: 1 }, { unique: true });

inventorySchema.pre("save", async function (next) {
  // Always calculate inHand as open - issuedQuantity
  this.inHand = Math.max(0, this.open - (this.issuedQuantity || 0));
  next();
});

module.exports = mongoose.model("inventory", inventorySchema);
