const mongoose = require("mongoose");

const siteinventorySchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
    },
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
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true, transform: docTransform },
    toObject: { virtuals: true, transform: docTransform }
  }
);

// ✅ transform function to rename itemId -> item
function docTransform(doc, ret) {
  if (ret.itemId) {
    ret.item = ret.itemId;
    delete ret.itemId;
  }
  return ret;
}


siteinventorySchema.pre("save", async function (next) {
  if (this.isNew) {
    this.inHand = this.open;
  } else {
    const existing = await mongoose.model("SiteInventory").findById(this._id); // corrected model name
    if (existing) {
      this.inHand = existing.inHand + this.open;
    }
  }
  next();
});

module.exports = mongoose.model("SiteInventory", siteinventorySchema);
