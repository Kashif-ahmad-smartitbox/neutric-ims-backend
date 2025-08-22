const express = require("express");
const router = express.Router();
const PurchaseOrderModel = require("../models/purchaseOrder");
const { protect } = require("../middleware/authMiddleware");

router.post("/create", protect, async (req, res) => {
  try {
    const { materialRequestNo,  SupplierId,  billTo, shipTo,   items,  deliveryDate  } = req.body;

    let requestedBy = req.user.id

    if (!materialRequestNo ||!SupplierId ||!billTo ||!shipTo ||!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    const purchaseOrderno = await generatePurchaseOrderNo();
    const updatedItems = items.map((item) => {
      const price = Number(item.price) || 0;
      const gst = Number(item.gst) || 0;
      const total = price * item.purchaseQty + (price * item.purchaseQty * gst) / 100;
      return { ...item, price, gst, total };
    });

    const purchaseOrder = await PurchaseOrderModel.create({
      purchaseOrderno,
      materialRequestNo,
      SupplierId,
      billTo,
      shipTo,
      items: updatedItems,
      deliveryDate,
      requestedBy,
    });

    res.status(201).json({
      success: true,
      message: "Purchase Order created successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error creating Purchase Order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});


router.get("/get-all", async (req, res) => {
  try {
    const orders = await PurchaseOrderModel.find()
      .populate("SupplierId", "name contact")
      .populate("shipTo", "siteName location")
      .populate("items._id", "description uom category")
      .populate("requestedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Purchase Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedOrder = await PurchaseOrderModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Purchase Order updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await PurchaseOrderModel.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Purchase Order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


async function generatePurchaseOrderNo() {
  const lastOrder = await PurchaseOrderModel.findOne().sort({ createdAt: -1 });
  let newNumber = 1;

  if (lastOrder && lastOrder.purchaseOrderno) {
    const lastNo = parseInt(lastOrder.purchaseOrderno.replace("PO-", ""));
    newNumber = lastNo + 1;
  }

  return `PO-${newNumber.toString().padStart(5, "0")}`; // Example: PO-00001
}


module.exports = router;
