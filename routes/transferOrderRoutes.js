const express = require("express");
const router = express.Router();
const TransferOrderModel = require("../models/TransferOrder");


router.post("/create", async (req, res) => {
  try {
    const transferNo = await generateTransferNo();
    const newOrder = new TransferOrder({
      transferNo,
      ...req.body,
    });

    await newOrder.save();
    res.status(201).json({ success: true, data: newOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const orders = await TransferOrderModel.find()
      .populate("from to requestedBy requestedTo", "name siteName email"); // populate related fields
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const order = await TransferOrderModel.findById(req.params.id)
      .populate("from to requestedBy requestedTo", "name siteName email");

    if (!order) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updatedOrder = await TransferOrderModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedOrder) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: updatedOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const deleted = await TransferOrderModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, message: "Transfer order deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


const generateTransferNo = async () => {
  const lastOrder = await TransferOrderModel.findOne().sort({ createdAt: -1 });
  if (!lastOrder) return "TO-0001";

  const lastNo = parseInt(lastOrder.transferNo.split("-")[1]) || 0;
  const newNo = (lastNo + 1).toString().padStart(4, "0");
  return `TO-${newNo}`;
};


module.exports = router;
