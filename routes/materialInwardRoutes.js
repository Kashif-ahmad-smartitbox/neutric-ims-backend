const express = require("express")
const MaterialInwardModel = require("../models/MaterialInward")

const router = express.Router();

router.post("/create", protect, async (req, res) => {
  try {
    let { items } = req.body;

    const grnNo = await generateGRNNo();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
    }

    items = items.map((item) => ({
      ...item,
      balanceQty: Number(item.balanceQty) || 0,
      receiveQty: Number(item.receiveQty) || 0,
      pendingQty: Number(item.pendingQty) || 0,
    }));

    const newGRN = await GRN.create({
      grnNo,
      receivedBy: req.user.name, 
      materialIssueNo: req.body.materialIssueNo || "",
      transferNo: req.body.transferNo || "",
      vehicleNo: req.body.vehicleNo || "",
      exitDateTime: req.body.exitDateTime || null,
      challanNo: req.body.challanNo || "",
      challanDate: req.body.challanDate || null,
      invoiceNo: req.body.invoiceNo || "",
      invoiceDate: req.body.invoiceDate || null,
      type: req.body.type,
      subType: req.body.subType || "",
      items,
    });

    const populatedGRN = await MaterialInwardModel.findById(newGRN._id).populate(
      "items.itemId",
      "description uom category"
    );

    res.status(201).json({
      success: true,
      message: "GRN created successfully",
      data: populatedGRN,
    });
  } catch (error) {
    console.error("Error creating GRN:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});


router.get("/all", protect, async (req, res) => {
  try {
    const grns = await MaterialInwardModel.find()
      .populate("items.itemId", "description uom category")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: grns.length,
      data: grns,
    });
  } catch (error) {
    console.error("Error fetching GRNs:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

const generateGRNNo = async () => {
  const lastOrder = await MaterialInwardModel.findOne().sort({ createdAt: -1 });
  if (!lastOrder) return "GRN-0001";

  const lastNo = parseInt(lastOrder.transferNo.split("-")[1]) || 0;
  const newNo = (lastNo + 1).toString().padStart(4, "0");
  return `GRN-${newNo}`;
};

export default router;
