const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
    unique: true,
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

inventorySchema.pre("save", async function (next) {
  if (this.isNew) {
    this.inHand = this.open;
  } else {
    const existing = await mongoose.model("inventory").findById(this._id);
    if (existing) {
      this.inHand = existing.inHand + this.open; // Add open to inHand
    }
  }
  next();
});

module.exports = mongoose.model("inventory", inventorySchema);
