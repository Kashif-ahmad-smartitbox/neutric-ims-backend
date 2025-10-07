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


// Virtual field to always calculate inHand dynamically
siteinventorySchema.virtual('calculatedInHand').get(function() {
  return Math.max(0, this.open - (this.issuedQuantity || 0));
});

siteinventorySchema.pre("save", async function (next) {
  // Always calculate inHand as open - issuedQuantity
  this.inHand = Math.max(0, this.open - (this.issuedQuantity || 0));
  next();
});

module.exports = mongoose.model("SiteInventory", siteinventorySchema);
