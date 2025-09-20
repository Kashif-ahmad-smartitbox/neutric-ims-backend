const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const PurchaseOrder = require("../models/purchaseOrder");
const MaterialRequest = require("../models/MaterialRequest");
const Site = require("../models/Site");
const User = require("../models/User");
const Supplier = require("../models/Supplier");
const TransferOrder = require("../models/TransferOrder");

// Get all purchase orders
router.get("/get-all", protect, async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.find()
      .populate("supplier", "supplierName address state gstin email")
      .populate("createdBy", "name");
    
    // Manually populate billTo and shipTo based on whether it's a Site or User reference
    const purchaseOrdersWithPopulatedFields = await Promise.all(
      purchaseOrders.map(async (po) => {
        const populatedPO = { ...po.toObject(), _id: po._id };
        
        // Populate billTo
        if (po.billTo) {
          try {
            const billToDoc = await Site.findById(po.billTo);
            if (billToDoc) {
              populatedPO.billTo = {
                _id: billToDoc._id,
                siteName: billToDoc.siteName,
                address: billToDoc.address,
                state: billToDoc.state,
                gstin: billToDoc.gstin,
                email: billToDoc.email,
                stateCode: billToDoc.stateCode,
                type: 'Site'
              };
            } else {
              // Check if it's a User reference (center store incharge)
              const userDoc = await User.findById(po.billTo);
              if (userDoc) {
                populatedPO.billTo = {
                  _id: userDoc._id,
                  siteName: userDoc.name,
                  email: userDoc.email,
                  role: userDoc.role,
                  type: 'User'
                };
              }
            }
          } catch (error) {
            console.error("Error populating billTo:", error);
            populatedPO.billTo = null;
          }
        }
        
        // Populate shipTo
        if (po.shipTo) {
          try {
            const shipToDoc = await Site.findById(po.shipTo);
            if (shipToDoc) {
              populatedPO.shipTo = {
                _id: shipToDoc._id,
                siteName: shipToDoc.siteName,
                address: shipToDoc.address,
                state: shipToDoc.state,
                gstin: shipToDoc.gstin,
                email: shipToDoc.email,
                stateCode: shipToDoc.stateCode,
                type: 'Site'
              };
            } else {
              // Check if it's a User reference (center store incharge)
              const userDoc = await User.findById(po.shipTo);
              if (userDoc) {
                populatedPO.shipTo = {
                  _id: userDoc._id,
                  siteName: userDoc.name,
                  email: userDoc.email,
                  role: userDoc.role,
                  type: 'User'
                };
              }
            }
          } catch (error) {
            console.error("Error populating shipTo:", error);
            populatedPO.shipTo = null;
          }
        }
        
        return populatedPO;
      })
    );
    
    res.json({ success: true, purchaseOrders: purchaseOrdersWithPopulatedFields });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get next purchase order number
router.get("/next-po-no", protect, async (req, res) => {
  try {
    const lastPO = await PurchaseOrder.findOne().sort({ createdAt: -1 });
    let nextPONo = "PO001";
    if (lastPO && lastPO.purchaseOrderNo) {
      const num = parseInt(lastPO.purchaseOrderNo.replace("PO", "")) + 1;
      nextPONo = `PO${num.toString().padStart(3, "0")}`;
    }
    res.json({ success: true, nextPONo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create purchase order
router.post("/create", protect, async (req, res) => {
  try {
    const purchaseOrder = new PurchaseOrder({
      ...req.body,
      createdBy: req.user._id,
    });
    await purchaseOrder.save();

    // Create Transfer Order with type "Supplied"
    const transferNo = await generateTransferNo();
    const transferOrder = new TransferOrder({
      transferNo: transferNo,
      materialIssueNo: purchaseOrder.purchaseOrderNo, // Using PO number as reference
      type: "Supplied",
      vehicleNumber: req.body.vehicleNumber || null,
      from: req.body.supplier, // Supplier as the source
      to: req.body.shipTo, // Ship to site as destination
      requestedBy: req.user._id,
      requestedTo: req.body.shipTo, // Same as destination for supplied items
      exitDateTime: req.body.deliveryDate, // Using delivery date as exit date
    });

    await transferOrder.save();

    res.json({ 
      success: true, 
      purchaseOrder,
      transferOrder 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update purchase order
router.put("/update/:id", protect, async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase order not found" });
    }
    if (purchaseOrder.status === "Approved") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot edit approved purchase order" });
    }
    Object.assign(purchaseOrder, req.body);
    await purchaseOrder.save();
    res.json({ success: true, purchaseOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve purchase order
router.put("/approve/:id", protect, async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    if (!purchaseOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase order not found" });
    }
    purchaseOrder.status = "Approved";
    await purchaseOrder.save();
    res.json({ success: true, purchaseOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Close purchase order
router.post("/close", protect, async (req, res) => {
  try {
    const { purchaseOrderId } = req.body;
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);
    if (!purchaseOrder) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase order not found" });
    }
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admins can close purchase orders" });
    }
    purchaseOrder.status = "Closed";
    await purchaseOrder.save();
    res.json({ success: true, purchaseOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete purchase order
router.post("/delete", protect, async (req, res) => {
  try {
    const { purchaseOrderIds } = req.body;
    const purchaseOrders = await PurchaseOrder.find({
      _id: { $in: purchaseOrderIds },
    });
    for (const po of purchaseOrders) {
      if (po.status === "Approved" || po.status === "Closed") {
        return res
          .status(400)
          .json({ success: false, message: "Cannot delete approved or closed purchase orders" });
      }
    }
    await PurchaseOrder.deleteMany({ _id: { $in: purchaseOrderIds } });
    res.json({ success: true, message: "Purchase orders deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all approved material requests
router.get("/material-request/get-all", protect, async (req, res) => {
  try {
    const materialRequests = await MaterialRequest.find({ 
      status: "approved",
      siteId: null
    })
      .populate("items._id", "itemCode category description uom gst");
    res.json({ success: true, requests: materialRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all sites
router.get("/site/get-all", protect, async (req, res) => {
  try {
    const sites = await Site.find().select(
      "siteName address state gstin email stateCode"
    );
    res.json({ success: true, sites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all users (for center store incharge)
router.get("/user/get-all", protect, async (req, res) => {
  try {
    const users = await User.find().select("name role email");
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all suppliers
router.get("/supplier/get-all-suppliers", protect, async (req, res) => {
  try {
    const suppliers = await Supplier.find().select(
      "supplierName address state gstin email"
    );
    res.json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all purchase order items
router.get("/items-status", protect, async (req, res) => {
  try {
    const purchaseOrders = await PurchaseOrder.find()
      .populate("supplier", "supplierName")
      .populate("materialRequestNo", "siteId")
      .lean();

    const items = await Promise.all(
      purchaseOrders.map(async (po) => {
        let siteInfo = null;
        const materialRequest = await MaterialRequest.findOne({
          materialRequestNo: po.materialRequestNo,
        }).populate("siteId", "siteName");

        if (materialRequest && materialRequest.siteId) {
          const siteDoc = await Site.findById(materialRequest.siteId).select("siteName");
          if (siteDoc) {
            siteInfo = { _id: siteDoc._id, siteName: siteDoc.siteName, type: "Site" };
          }
        } else {
          // Center store incharge (siteId: null)
          const userDoc = await User.findOne({ role: "center store incharge" }).select("name");
          if (userDoc) {
            siteInfo = { _id: userDoc._id, siteName: userDoc.name, type: "User" };
          }
        }

        return po.items.map((item) => ({
          purchaseOrderId: po._id,
          purchaseOrderNo: po.purchaseOrderNo,
          supplier: { supplierName: po.supplier?.supplierName || "" },
          site: siteInfo || { _id: null, siteName: "Unknown", type: "Unknown" },
          deliveryDate: po.deliveryDate,
          createdAt: po.createdAt,
          itemCode: item.itemCode,
          category: item.category,
          description: item.description,
          uom: item.uom,
          purchaseQty: item.purchaseQty,
          receivedQty: item.receivedQty || 0,
          pendingQty: item.pendingQty || item.purchaseQty,
          status: item.status || (item.pendingQty === 0 ? "Completed" : "Pending"),
        }));
      })
    );

    res.json({ success: true, items: items.flat() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get purchase order items for a specific site
router.get("/items-status/:siteId", protect, async (req, res) => {
  try {
    const { siteId } = req.params;
    const isCentralStore = siteId === "null";

    const materialRequests = await MaterialRequest.find(
      isCentralStore ? { siteId: null } : { siteId }
    ).select("materialRequestNo");

    const materialRequestNos = materialRequests.map((mr) => mr.materialRequestNo);

    const purchaseOrders = await PurchaseOrder.find({
      materialRequestNo: { $in: materialRequestNos },
    })
      .populate("supplier", "supplierName")
      .lean();

    const items = await Promise.all(
      purchaseOrders.map(async (po) => {
        let siteInfo = null;
        const materialRequest = await MaterialRequest.findOne({
          materialRequestNo: po.materialRequestNo,
        }).populate("siteId", "siteName");

        if (materialRequest && materialRequest.siteId) {
          const siteDoc = await Site.findById(materialRequest.siteId).select("siteName");
          if (siteDoc) {
            siteInfo = { _id: siteDoc._id, siteName: siteDoc.siteName, type: "Site" };
          }
        } else {
          // Center store incharge (siteId: null)
          const userDoc = await User.findOne({ role: "center store incharge" }).select("name");
          if (userDoc) {
            siteInfo = { _id: userDoc._id, siteName: userDoc.name, type: "User" };
          }
        }

        return po.items.map((item) => ({
          purchaseOrderId: po._id,
          purchaseOrderNo: po.purchaseOrderNo,
          supplier: { supplierName: po.supplier?.supplierName || "" },
          site: siteInfo || { _id: null, siteName: "Unknown", type: "Unknown" },
          deliveryDate: po.deliveryDate,
          createdAt: po.createdAt,
          itemCode: item.itemCode,
          category: item.category,
          description: item.description,
          uom: item.uom,
          purchaseQty: item.purchaseQty,
          receivedQty: item.receivedQty || 0,
          pendingQty: item.pendingQty || item.purchaseQty,
          status: item.status || (item.pendingQty === 0 ? "Completed" : "Pending"),
        }));
      })
    );

    res.json({ success: true, items: items.flat() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate transfer number
const generateTransferNo = async () => {
  const lastOrder = await TransferOrder.findOne().sort({ createdAt: -1 });
  if (!lastOrder) return "TO-0001";

  const lastNo = parseInt(lastOrder.transferNo.split("-")[1]) || 0;
  const newNo = (lastNo + 1).toString().padStart(4, "0");
  return `TO-${newNo}`;
};

module.exports = router;