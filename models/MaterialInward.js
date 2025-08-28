import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  itemCode: { type: String, required: true },
  category: { type: String },
  description: { type: String },
  uom: { type: String },
  balanceQty: { type: Number, default: 0 },
  receiveQty: { type: Number, default: 0 },
  pendingQty: { type: Number, default: 0 },
});

const grnSchema = new mongoose.Schema(
  {
    grnNo: { type: String, required: true, unique: true }, 
    receivedBy: { type: String, required: true },        
    materialIssueNo: { type: String },                     
    transferNo: { type: String },                       
    vehicleNo: { type: String },
    exitDateTime: { type: Date },
    challanNo: { type: String },
    challanDate: { type: Date },
    invoiceNo: { type: String },
    invoiceDate: { type: Date },
    status: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },
    type: { type: String, enum: ["Supplied", "Transferred"], required: true },
    subType: { type: String }, // if you want further categorization
    items: [itemSchema],
  },
  { timestamps: true }
);

export default mongoose.model("GRN", grnSchema);
