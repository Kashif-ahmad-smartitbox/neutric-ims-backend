const express = require("express");
const router = express.Router();
const PurchaseOrderModel = require("../models/purchaseOrder");
const transferOrderModel = require("../models/TransferOrder")
const { protect } = require("../middleware/authMiddleware");

router.post("/create", protect, async (req, res) => {
  try {
    const { materialRequestNo,  supplier,  billTo, shipTo, totalAmount , grandTotalIncGST , items, createdBy , deliveryDate , igst , sgst, cgst,  } = req.body;

    // let createdBy = req.user.id

    if (!materialRequestNo ||!supplier ||!billTo ||!shipTo ||!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    const purchaseOrderno = await generatePurchaseOrderNo();
    // const updatedItems = items.map((item) => {
    //   const price = Number(item.price) || 0;
    //   const gst = Number(item.gst) || 0;
    //   const total = price * item.purchaseQty + (price * item.purchaseQty * gst) / 100;
    //   return { ...item, price, gst, total };
    // });


    const purchaseOrder = await PurchaseOrderModel.create({
      purchaseOrderno,
      materialRequestNo,
      SupplierId : supplier._id,
      billTo : billTo._id ,
      shipTo : shipTo._id,
      items,
      deliveryDate,
      totalAmount,
      grandTotalIncGST ,
      createdBy : createdBy._id,
      igst,
      sgst,
      cgst
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

router.get("/get-all", async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrderModel.find()
      .populate("SupplierId", "supplierName contactPerson phone email") 
      .populate("shipTo", "siteName location") 
      .populate("billTo", "siteName location") 
      .populate("items._id", "description uom category") 
      .populate("createdBy", "name email") 
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: purchaseOrders,
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get("/get-all-to-be-received", async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrderModel.find()
      .populate("SupplierId", "supplierName")
      .populate("shipTo", "siteName")
      .populate("billTo", "siteName")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    const transferOrders = await transferOrderModel.find()
      .populate("from", "siteName")
      .populate("to", "siteName")
      .populate("requestedBy", "name")
      .sort({ createdAt: -1 });

    const poData = purchaseOrders.map((po) => ({
      createdAt: po.createdAt,
      no: po.purchaseOrderno, 
      type: "Supplied",
      supplier: po.SupplierId?.supplierName || "-",
      expectedDate: po.deliveryDate,
      status: po.status,
    }));

    const toData = transferOrders.map((to) => ({
      createdAt: to.createdAt,
      no: to.transferNo ||  to.materialIssueNo , 
      type: "Transferred",
      supplier: to.from?.siteName || "-", 
      expectedDate: to.exitDateTime,
      status: to.status,
    }));

    const combined = [...poData, ...toData].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      success: true,
      data: combined,
    });
  } catch (error) {
    console.error("Error fetching to-be-received:", error);
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
