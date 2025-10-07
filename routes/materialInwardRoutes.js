const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const MaterialInward = require("../models/MaterialInward");
const Site = require("../models/Site");
const MaterialIssue = require("../models/MaterialIssue");
const PurchaseOrder = require("../models/purchaseOrder");
const Supplier = require("../models/Supplier");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Get all GRNs
router.get("/get-all", protect, async (req, res) => {
  try {
    const grns = await MaterialInward.find()
      .populate("items.supplier", "supplierName address state gstin email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, grns });
  } catch (error) {
    console.error("Error fetching GRNs:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get next GRN number
router.get("/next-grn-no", protect, async (req, res) => {
  try {
    const lastGRN = await MaterialInward.findOne()
      .sort({ createdAt: -1 })
      .select("grnNo");
    let nextGRNNo = "GRN-0001";
    if (lastGRN && lastGRN.grnNo) {
      const num = parseInt(lastGRN.grnNo.split("-")[1]) + 1;
      nextGRNNo = `GRN-${num.toString().padStart(4, "0")}`;
    }
    res.json({ success: true, nextGRNNo });
  } catch (error) {
    console.error("Error generating next GRN number:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Create GRN
router.post("/create", protect, async (req, res) => {
  try {
    const {
      grnNo,
      type,
      subType,
      materialIssueNo,
      purchaseOrderNo,
      transferNo,
      vehicleNo,
      exitDateTime,
      challanNo,
      challanDate,
      invoiceNo,
      invoiceDate,
      receivedBy,
      supplierId,
      supplierName,
      items,
    } = req.body;

    // Validate required fields
    if (!grnNo || !type || !receivedBy || !items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Validate items
    for (const item of items) {
      if (
        !item.itemCode ||
        !item.category ||
        !item.description ||
        !item.uom ||
        item.receiveQty === undefined ||
        item.receiveQty < 0 ||
        item.balanceQty < item.receiveQty
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid item data" });
      }
    }

    // Validate supplier and MI/PO
    if (type === "Transferred" && (!materialIssueNo || !supplierId)) {
      return res
        .status(400)
        .json({ success: false, message: "Material Issue No and Supplier ID required for Transferred GRN" });
    }
    if (type === "Supplied" && (!purchaseOrderNo || !supplierId)) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase Order No and Supplier ID required for Supplied GRN" });
    }
    if (type === "Supplied" && subType === "Challan" && (!challanNo || !challanDate)) {
      return res
        .status(400)
        .json({ success: false, message: "Challan No and Date required for Challan GRN" });
    }
    if (type === "Supplied" && subType === "Invoice" && (!invoiceNo || !invoiceDate)) {
      return res
        .status(400)
        .json({ success: false, message: "Invoice No and Date required for Invoice GRN" });
    }

    // Validate Purchase Order quantities for Supplied GRN
    if (type === "Supplied" && purchaseOrderNo) {
      const purchaseOrder = await PurchaseOrder.findOne({ purchaseOrderNo });
      if (!purchaseOrder) {
        return res
          .status(400)
          .json({ success: false, message: "Purchase Order not found" });
      }

      // Check if GRN quantities exceed available PO quantities
      for (const grnItem of items) {
        const poItem = purchaseOrder.items.find(item => item.itemCode === grnItem.itemCode);
        if (!poItem) {
          return res
            .status(400)
            .json({ success: false, message: `Item ${grnItem.itemCode} not found in Purchase Order` });
        }

        const availableQty = poItem.purchaseQty - (poItem.receivedQty || 0);
        if (grnItem.receiveQty > availableQty) {
          return res
            .status(400)
            .json({ 
              success: false, 
              message: `Receive quantity (${grnItem.receiveQty}) for item ${grnItem.itemCode} exceeds available quantity (${availableQty}) in Purchase Order` 
            });
        }
      }
    }

    const grn = new MaterialInward({
      grnNo,
      type,
      subType,
      materialIssueNo,
      purchaseOrderNo,
      transferNo,
      vehicleNo,
      exitDateTime,
      challanNo,
      challanDate,
      invoiceNo,
      invoiceDate,
      receivedBy,
      supplierId,
      supplierName,
      items,
      pdfLink: `/pdfs/${grnNo}.pdf`,
    });

    await grn.save();

    // Update Purchase Order if this is a Supplied GRN
    if (type === "Supplied" && purchaseOrderNo) {
      await updatePurchaseOrderOnGRN(purchaseOrderNo, items);
    }

    res.json({ success: true, message: "GRN created successfully" });
  } catch (error) {
    console.error("Error creating GRN:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update GRN
router.post("/update", protect, async (req, res) => {
  try {
    const {
      grnNo,
      type,
      subType,
      materialIssueNo,
      purchaseOrderNo,
      transferNo,
      vehicleNo,
      exitDateTime,
      challanNo,
      challanDate,
      invoiceNo,
      invoiceDate,
      receivedBy,
      supplierId,
      supplierName,
      items,
    } = req.body;

    // Validate required fields
    if (!grnNo || !type || !receivedBy || !items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Validate items
    for (const item of items) {
      if (
        !item.itemCode ||
        !item.category ||
        !item.description ||
        !item.uom ||
        item.receiveQty === undefined ||
        item.receiveQty < 0 ||
        item.balanceQty < item.receiveQty
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid item data" });
      }
    }

    // Validate supplier and MI/PO
    if (type === "Transferred" && (!materialIssueNo || !supplierId)) {
      return res
        .status(400)
        .json({ success: false, message: "Material Issue No and Supplier ID required for Transferred GRN" });
    }
    if (type === "Supplied" && (!purchaseOrderNo || !supplierId)) {
      return res
        .status(400)
        .json({ success: false, message: "Purchase Order No and Supplier ID required for Supplied GRN" });
    }
    if (type === "Supplied" && subType === "Challan" && (!challanNo || !challanDate)) {
      return res
        .status(400)
        .json({ success: false, message: "Challan No and Date required for Challan GRN" });
    }
    if (type === "Supplied" && subType === "Invoice" && (!invoiceNo || !invoiceDate)) {
      return res
        .status(400)
        .json({ success: false, message: "Invoice No and Date required for Invoice GRN" });
    }

    // Validate Purchase Order quantities for Supplied GRN
    if (type === "Supplied" && purchaseOrderNo) {
      const purchaseOrder = await PurchaseOrder.findOne({ purchaseOrderNo });
      if (!purchaseOrder) {
        return res
          .status(400)
          .json({ success: false, message: "Purchase Order not found" });
      }

      // Get the old GRN to calculate net change in quantities
      const oldGrn = await MaterialInward.findOne({ grnNo });
      
      // Check if GRN quantities exceed available PO quantities
      for (const grnItem of items) {
        const poItem = purchaseOrder.items.find(item => item.itemCode === grnItem.itemCode);
        if (!poItem) {
          return res
            .status(400)
            .json({ success: false, message: `Item ${grnItem.itemCode} not found in Purchase Order` });
        }

        // Calculate net change in received quantity
        const oldGrnItem = oldGrn ? oldGrn.items.find(item => item.itemCode === grnItem.itemCode) : null;
        const oldReceivedQty = oldGrnItem ? oldGrnItem.receiveQty : 0;
        const netChange = grnItem.receiveQty - oldReceivedQty;

        const availableQty = poItem.purchaseQty - (poItem.receivedQty || 0) + oldReceivedQty;
        if (netChange > availableQty) {
          return res
            .status(400)
            .json({ 
              success: false, 
              message: `Net receive quantity change (${netChange}) for item ${grnItem.itemCode} exceeds available quantity (${availableQty}) in Purchase Order` 
            });
        }
      }
    }
    
    const grn = await MaterialInward.findOneAndUpdate(
      { grnNo },
      {
        type,
        subType,
        materialIssueNo,
        purchaseOrderNo,
        transferNo,
        vehicleNo,
        exitDateTime,
        challanNo,
        challanDate,
        invoiceNo,
        invoiceDate,
        receivedBy,
        supplierId,
        supplierName,
        items,
        pdfLink: `/pdfs/${grnNo}.pdf`,
      },
      { new: true }
    );

    if (!grn) {
      return res
        .status(404)
        .json({ success: false, message: "GRN not found" });
    }

    // Update Purchase Order if this is a Supplied GRN
    if (type === "Supplied" && purchaseOrderNo) {
      // If the old GRN was also Supplied and had a different PO, revert the old PO first
      if (oldGrn && oldGrn.type === "Supplied" && oldGrn.purchaseOrderNo && oldGrn.purchaseOrderNo !== purchaseOrderNo) {
        await revertPurchaseOrderOnGRN(oldGrn.purchaseOrderNo, oldGrn.items);
      }
      // Update the new Purchase Order
      await updatePurchaseOrderOnGRN(purchaseOrderNo, items);
    } else if (oldGrn && oldGrn.type === "Supplied" && oldGrn.purchaseOrderNo) {
      // If changing from Supplied to non-Supplied, revert the old PO
      await revertPurchaseOrderOnGRN(oldGrn.purchaseOrderNo, oldGrn.items);
    }

    res.json({ success: true, message: "GRN updated successfully" });
  } catch (error) {
    console.error("Error updating GRN:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get suppliers for Transferred GRNs (All Sites)
router.get("/suppliers/transferred", protect, async (req, res) => {
  try {
    const suppliers = await Site.find()
      .select("siteName _id")
      .lean();
    res.json({ success: true, suppliers });
  } catch (error) {
    console.error("Error fetching transferred suppliers:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get suppliers for Supplied GRNs
router.get("/suppliers/supplied", protect, async (req, res) => {
  try {
    // Check if user is center store incharge
    if (req.user.role === "center store incharge") {
      // Get suppliers from pending purchase orders (now per-item)
      const pendingPurchaseOrders = await PurchaseOrder.find({ 
        status: { $in: ["Pending", "partially received"] }
      })
        .populate("items.supplier", "supplierName _id")
        .select("items.supplier")
        .lean();
      
      // Extract unique suppliers from items
      const supplierMap = new Map();
      pendingPurchaseOrders.forEach(po => {
        po.items.forEach(item => {
          if (item.supplier && item.supplier._id) {
            supplierMap.set(item.supplier._id.toString(), {
              _id: item.supplier._id,
              supplierName: item.supplier.supplierName
            });
          }
        });
      });
      
      const suppliers = Array.from(supplierMap.values());
      res.json({ success: true, suppliers });
    } else {
      // For other roles, return sites as before
      const suppliers = await Site.find({ hierarchy: "Site" })
        .select("siteName _id")
        .lean();
      res.json({ success: true, suppliers });
    }
  } catch (error) {
    console.error("Error fetching supplied suppliers:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get pending Material Issues for a supplier
router.get("/suppliers/:supplierId/pending-mis", protect, async (req, res) => {
  try {
    const { supplierId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid supplier ID" });
    }
    const materialIssues = await MaterialIssue.find({
      issuedTo: supplierId,
      $or: [
        { "shipmentDetails.materialInwardStatus": { $in: ["pending", "partially received"] } },
        { "shipmentDetails.materialInwardStatus": { $exists: false } }
      ]
    })
      .select("materialIssueNumber")
      .lean();
    const pendingMIs = materialIssues.map((mi) => mi.materialIssueNumber);
    res.json({ success: true, pendingMIs });
  } catch (error) {
    console.error("Error fetching pending MIs:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get pending Purchase Orders for a supplier
router.get("/suppliers/:supplierId/pending-pos", protect, async (req, res) => {
  try {
    const { supplierId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid supplier ID" });
    }
    const purchaseOrders = await PurchaseOrder.find({
      "items.supplier": supplierId,
      status: { $in: ["Pending", "partially received"] },
    })
      .select("purchaseOrderNo")
      .lean();
    const pendingPOs = purchaseOrders.map((po) => po.purchaseOrderNo);
    res.json({ success: true, pendingPOs });
  } catch (error) {
    console.error("Error fetching pending POs:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get Material Issue details
router.get("/material-issue/get/:materialIssueNo", protect, async (req, res) => {
  try {
    const { materialIssueNo } = req.params;
    const materialIssue = await MaterialIssue.findOne({ materialIssueNumber: materialIssueNo })
      .populate("items.item", "itemCode category description uom")
      .populate("shipmentDetails.transferOrderId", "transferNo")
      .lean();
    if (!materialIssue) {
      return res
        .status(404)
        .json({ success: false, message: "Material Issue not found" });
    }
    const issue = {
      ...materialIssue,
      items: materialIssue.items.map((item) => ({
        itemCode: item.item.itemCode,
        category: item.item.category,
        description: item.item.description,
        uom: item.item.uom,
        balanceQty: item.issueQty,
        orderQty: item.issueQty,
      })),
      transferOrder: {
        transferNo: materialIssue.shipmentDetails?.transferOrderId?.transferNo || materialIssue.shipmentDetails?.transferNo,
        vehicleNo: materialIssue.shipmentDetails?.vehicleNo,
        exitDateTime: materialIssue.shipmentDetails?.dateAndExitTime,
      },
    };
    res.json({ success: true, issue });
  } catch (error) {
    console.error("Error fetching Material Issue:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get Purchase Order details
router.get("/purchase-order/get/:purchaseOrderNo", protect, async (req, res) => {
  try {
    const { purchaseOrderNo } = req.params;
    const purchaseOrder = await PurchaseOrder.findOne({ purchaseOrderNo })
      .populate("items.supplier", "supplierName _id")
      .lean();
    if (!purchaseOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase Order not found" });
    }
    const po = {
      ...purchaseOrder,
      items: purchaseOrder.items.map((item) => ({
        itemCode: item.itemCode,
        category: item.category,
        description: item.description,
        uom: item.uom,
        balanceQty: item.purchaseQty,
        orderQty: item.purchaseQty,
        requestedQty: item.requestedQty,
        price: item.price,
        gst: item.gst,
        total: item.total,
        receivedQty: item.receivedQty,
        pendingQty: item.pendingQty,
        status: item.status,
        supplier: item.supplier,
      })),
    };
    res.json({ success: true, purchaseOrder: po });
  } catch (error) {
    console.error("Error fetching Purchase Order:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Delete GRN
router.delete("/delete/:grnNo", protect, async (req, res) => {
  try {
    const { grnNo } = req.params;
    
    // Get the GRN to check if it's a Supplied GRN
    const grn = await MaterialInward.findOne({ grnNo });
    if (!grn) {
      return res
        .status(404)
        .json({ success: false, message: "GRN not found" });
    }

    // If it's a Supplied GRN, revert the Purchase Order
    if (grn.type === "Supplied" && grn.purchaseOrderNo) {
      await revertPurchaseOrderOnGRN(grn.purchaseOrderNo, grn.items);
    }

    // Delete the GRN
    await MaterialInward.findOneAndDelete({ grnNo });
    
    res.json({ success: true, message: "GRN deleted successfully" });
  } catch (error) {
    console.error("Error deleting GRN:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Helper function to update Purchase Order when GRN is created/updated
async function updatePurchaseOrderOnGRN(purchaseOrderNo, grnItems) {
  try {
    const purchaseOrder = await PurchaseOrder.findOne({ purchaseOrderNo });
    if (!purchaseOrder) {
      console.error(`Purchase Order ${purchaseOrderNo} not found`);
      return;
    }

    // Update item quantities and status
    let allItemsCompleted = true;
    let anyItemReceived = false;

    for (const poItem of purchaseOrder.items) {
      const grnItem = grnItems.find(item => item.itemCode === poItem.itemCode);
      
      if (grnItem) {
        // Add received quantity
        poItem.receivedQty = (poItem.receivedQty || 0) + grnItem.receiveQty;
        poItem.pendingQty = poItem.purchaseQty - poItem.receivedQty;
        
        // Update item status
        if (poItem.pendingQty <= 0) {
          poItem.status = "Completed";
        } else {
          poItem.status = "partially received";
          allItemsCompleted = false;
        }
        
        if (poItem.receivedQty > 0) {
          anyItemReceived = true;
        }
      }
    }

    // Update overall PO status
    if (allItemsCompleted && anyItemReceived) {
      purchaseOrder.status = "Completed";
    } else if (anyItemReceived) {
      purchaseOrder.status = "partially received";
    }

    await purchaseOrder.save();
    console.log(`Purchase Order ${purchaseOrderNo} updated successfully`);
  } catch (error) {
    console.error(`Error updating Purchase Order ${purchaseOrderNo}:`, error);
    throw error;
  }
}

// Helper function to revert Purchase Order when GRN is updated/deleted
async function revertPurchaseOrderOnGRN(purchaseOrderNo, grnItems) {
  try {
    const purchaseOrder = await PurchaseOrder.findOne({ purchaseOrderNo });
    if (!purchaseOrder) {
      console.error(`Purchase Order ${purchaseOrderNo} not found`);
      return;
    }

    // Revert item quantities
    for (const poItem of purchaseOrder.items) {
      const grnItem = grnItems.find(item => item.itemCode === poItem.itemCode);
      
      if (grnItem) {
        // Subtract received quantity
        poItem.receivedQty = Math.max(0, (poItem.receivedQty || 0) - grnItem.receiveQty);
        poItem.pendingQty = poItem.purchaseQty - poItem.receivedQty;
        
        // Update item status
        if (poItem.receivedQty <= 0) {
          poItem.status = "Pending";
        } else if (poItem.pendingQty > 0) {
          poItem.status = "partially received";
        } else {
          poItem.status = "Completed";
        }
      }
    }

    // Check if any items still have received quantities
    const hasReceivedItems = purchaseOrder.items.some(item => (item.receivedQty || 0) > 0);
    
    // Update overall PO status
    if (!hasReceivedItems) {
      purchaseOrder.status = "Pending";
    } else {
      const allItemsCompleted = purchaseOrder.items.every(item => 
        item.pendingQty <= 0 || item.status === "Completed"
      );
      purchaseOrder.status = allItemsCompleted ? "Completed" : "partially received";
    }

    await purchaseOrder.save();
    console.log(`Purchase Order ${purchaseOrderNo} reverted successfully`);
  } catch (error) {
    console.error(`Error reverting Purchase Order ${purchaseOrderNo}:`, error);
    throw error;
  }
}

// Update GRN received status
router.put("/update/:grnId", protect, async (req, res) => {
  try {
    const { grnId } = req.params;
    const { isReceived, invoiceNo, invoiceDate, subType } = req.body;
    const { _id: userId } = req.user;

    // Validate GRN ID
    if (!mongoose.Types.ObjectId.isValid(grnId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid GRN ID",
      });
    }

    // Find the GRN
    const grn = await MaterialInward.findById(grnId);
    if (!grn) {
      return res.status(404).json({
        success: false,
        message: "GRN not found",
      });
    }

    // Prepare update data
    const updateData = {
      isReceived,
      receivedAt: isReceived ? new Date() : null,
      receivedBy: isReceived ? userId : null,
    };

    // If updating to received and it's a Supplied Challan type, update invoice details
    if (isReceived && grn.type === "Supplied" && grn.subType === "Challan") {
      if (invoiceNo && invoiceDate) {
        updateData.invoiceNo = invoiceNo;
        updateData.invoiceDate = new Date(invoiceDate);
        updateData.subType = subType || "Invoice";
      }
    }

    // Update the GRN
    const updatedGrn = await MaterialInward.findByIdAndUpdate(
      grnId,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: `GRN ${isReceived ? "marked as received" : "marked as pending"}`,
      data: updatedGrn,
    });
  } catch (error) {
    console.error("Error updating GRN status:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;