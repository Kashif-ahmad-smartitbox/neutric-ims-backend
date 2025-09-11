const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const MaterialRequestModel = require("../models/MaterialRequest");
const userModel = require("../models/User");
const InventoryModel = require("../models/Inventotry");
const ItemModel = require("../models/Item");
const siteInventoryModel = require("../models/SiteInventory");
const PurchaseModel= require("../models/purchaseOrder")
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/create", protect, async (req, res) => {
  try {
    let { siteId, items } = req.body;

    siteId = req.user.site;

    let materialRequestNo = await generateMaterialRequestNo();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
    }

    items = items.map((item) => ({
      ...item,
      requestedQty: Number(item.requestedQty),
    }));



    let requestedTo;
    if (req.user.role === "junior site engineer") {
      let user = await userModel.findOne({
        site: req.user.site,
        role: "site store incharge",
      });
      requestedTo = user._id;
    } else if (req.user.role === "site store incharge") {
      let user = await userModel.findOne({
        role: "center store incharge",
      });
      requestedTo = user._id;
    } else if (req.user.role === "center store incharge") {
      let user = await userModel.findOne({
        role: "purchase manager",
      });
      requestedTo = user._id;
    }

    const materialRequest = await MaterialRequestModel.create({
      materialRequestNo,
      requestedBy: req.user.id,
      siteId,
      requestedTo,
      items,
    });

    for (const item of items) {
      const  { _id : itemId, requestedQty } = item;
      await siteInventoryModel.findOneAndUpdate(
        { itemId, siteId },
        {
          $inc: {
            requestQuantity: requestedQty,
          },
          $setOnInsert: {
            open: 0,
            issuedQuantity: 0,
            mip: 0,
            inHand: 0,
          },
        },
        { new: true, upsert: true }
      );

      await InventoryModel.findOneAndUpdate(
        { itemId },
        {
          $inc: {
            requestQuantity: requestedQty,
          },
          $setOnInsert: {
            open: 0,
            issuedQuantity: 0,
            mip: 0,
            inHand: 0,
            siteId,
          },
        },
        { new: true, upsert: true }
      );
    }

    res.status(201).json({
      success: true,
      message: "Material request created successfully",
      data: materialRequest,
    });
  } catch (error) {
    console.error("Error creating material request:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.get("/get-all", protect, async (req, res) => {
  try {
    let siteId = req.user.site;
    let userId = req.user._id;

    const requests = await MaterialRequestModel.find({
      requestedBy: new mongoose.Types.ObjectId(userId),
    })
      .populate({
        path: "requestedBy",
        select: "name",
      })
      .populate({
        path: "siteId",
        select: "siteName",
      })
      .populate({
        path: "items._id",
        select: "itemCode description uom category gst",
      })
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map((req) => ({
      ...req.toObject(),
      items: req.items.map((it) => ({
        _id: it._id?._id, // actual item id
        itemCode: it._id?.itemCode,
        description: it._id?.description,
        uom: it._id?.uom,
        category: it._id?.category,
        gst: it._id?.gst,
        requestedQty: it.requestedQty,
      })),
    }));

    res.status(200).json({ success: true, data: formattedRequests });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let { requestedBy, siteId, items, status } = req.body;

    if (items && Array.isArray(items)) {
      items = items.map((item) => ({
        ...item,
        requestedQty: Number(item.requestedQty),
      }));
    }

    const updatedRequest = await MaterialRequestModel.findByIdAndUpdate(
      id,
      { requestedBy, siteId, items, status },
      { new: true, runValidators: true }
    );

    if (!updatedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Material request not found" });
    }

    res.status(200).json({ success: true, data: updatedRequest });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    const deleted = await MaterialRequestModel.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Material request not found" });
    }

    res.status(200).json({
      success: true,
      message: "Material request deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.get("/get-all-approve", protect, async (req, res) => {
  try {
    let query = {};

    // Role-based filtering
    if (req.user.role === "site store incharge") {
      const juniorIds = await mongoose.model('User').find({ role: 'junior site engineer' }).distinct('_id');
      query = {
        $and: [
          { siteId: new mongoose.Types.ObjectId(req.user.site) },
          { requestedBy: { $in: juniorIds } },
          { requestedBy: { $ne: new mongoose.Types.ObjectId(req.user._id) } }
        ]
      };
    } else if (req.user.role === "center store incharge") {
      const siteStoreIds = await mongoose.model('User').find({ role: 'site store incharge' }).distinct('_id');
      query = {
        $and: [
          { requestedBy: { $in: siteStoreIds } },
          { requestedBy: { $ne: new mongoose.Types.ObjectId(req.user._id) } }
        ]
      };
    } else if (req.user.role === "purchase manager") {
      const centerStoreIds = await mongoose.model('User').find({ role: 'center store incharge' }).distinct('_id');
      query = {
        $and: [
          { requestedBy: { $in: centerStoreIds } },
          { requestedBy: { $ne: new mongoose.Types.ObjectId(req.user._id) } }
        ]
      };
    } else if (req.user.role === "admin") {
      query = {
        requestedBy: { $ne: new mongoose.Types.ObjectId(req.user._id) }
      };
    } else {
      query = {
        $and: [
          { requestedTo: new mongoose.Types.ObjectId(req.user._id) },
          { requestedBy: { $ne: new mongoose.Types.ObjectId(req.user._id) } }
        ]
      };
    }

    const requests = await MaterialRequestModel.find(query)
      .populate({
        path: "requestedBy",
        select: "name role",
      })
      .populate({
        path: "siteId",
        select: "siteName",
      })
      .populate({
        path: "items._id",
        select: "itemCode description uom category gst",
      })
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map((req) => ({
      ...req.toObject(),
      items: req.items.map((it) => ({
        _id: it._id?._id,
        itemCode: it._id?.itemCode,
        description: it._id?.description,
        uom: it._id?.uom,
        category: it._id?.category,
        gst: it._id?.gst,
        requestedQty: it.requestedQty,
      })),
    }));

    res.status(200).json({ success: true, data: formattedRequests });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.get("/get-all-approved", protect, async (req, res) => {
  try {
    let query = {
      status: "approved"
    };

    // Role-based filtering
    if (req.user.role === "site store incharge") {
      // Site store incharge can only see approved requests from their own site
      query.siteId = new mongoose.Types.ObjectId(req.user.site);
    } else if (req.user.role === "center store incharge" || req.user.role === "purchase manager" || req.user.role === "admin") {
      // These roles can see all approved material requests - no additional filtering needed
      // query already has status: "approved"
    } else {
      // For other roles, show only approved requests where they are the requestedTo
      query.requestedTo = new mongoose.Types.ObjectId(req.user._id);
    }

    const requests = await MaterialRequestModel.find(query)
      .populate({
        path: "requestedBy",
        select: "name",
      })
      .populate({
        path: "requestedTo",
        select: "name",
      })
      .populate({
        path: "siteId",
        select: "siteName",
      })
      .populate({
        path: "items._id",
        select: "itemCode description uom category gst",
      })
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map((req) => ({
      ...req.toObject(),
      items: req.items.map((it) => ({
        _id: it._id?._id, // actual item id
        itemCode: it._id?.itemCode,
        description: it._id?.description,
        uom: it._id?.uom,
        category: it._id?.category,
        gst: it._id?.gst,
        requestedQty: it.requestedQty,
      })),
    }));

    res.status(200).json({ success: true, data: formattedRequests });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.get("/get-all-cw-issue/:id", protect, async (req, res, next) => {
  try {
    let userId = req.user._id;
    let targetSiteId = req.params.id;

    // Determine siteId for inventory lookup
    let siteId = req.user.site;
    if (
      req.user.role === "center store incharge" ||
      req.user.role === "purchase manager" ||
      req.user.role === "admin"
    ) {
      // For center store incharge, use null siteId for their own inventory
      siteId = req.user.role === "center store incharge" ? null : targetSiteId;
    }

    // Role-based filtering for material requests
    let materialRequestQuery = {
      siteId: targetSiteId,
      status: "approved",
    };

    // Apply role-based filtering
    if (req.user.role === "site store incharge") {
      if (targetSiteId !== req.user.site) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own site's data.",
        });
      }
      const juniorIds = await mongoose
        .model("User")
        .find({ role: "junior site engineer" })
        .distinct("_id");
      materialRequestQuery.$and = [
        { requestedBy: { $in: juniorIds } },
        { requestedBy: { $ne: new mongoose.Types.ObjectId(userId) } },
      ];
    } else if (req.user.role === "center store incharge") {
      const siteStoreIds = await mongoose
        .model("User")
        .find({ role: "site store incharge" })
        .distinct("_id");
      materialRequestQuery.$and = [
        { requestedBy: { $in: siteStoreIds } },
        { requestedBy: { $ne: new mongoose.Types.ObjectId(userId) } },
      ];
    } else if (req.user.role === "purchase manager") {
      const centerStoreIds = await mongoose
        .model("User")
        .find({ role: "center store incharge" })
        .distinct("_id");
      materialRequestQuery.$and = [
        { requestedBy: { $in: centerStoreIds } },
        { requestedBy: { $ne: new mongoose.Types.ObjectId(userId) } },
      ];
    } else if (req.user.role === "admin") {
      materialRequestQuery.requestedBy = {
        $ne: new mongoose.Types.ObjectId(userId),
      };
    } else {
      materialRequestQuery.$and = [
        { requestedTo: new mongoose.Types.ObjectId(userId) },
        { requestedBy: { $ne: new mongoose.Types.ObjectId(userId) } },
      ];
    }

    // Get all approved materialRequests for given site
    let materialRequests = await MaterialRequestModel.find(materialRequestQuery)
      .populate({
        path: "requestedBy",
        select: "name role",
      })
      .populate({
        path: "siteId",
        select: "siteName",
      })
      .populate({
        path: "items._id",
        select: "itemCode category description uom",
      });

    // Use a Map to combine items by itemCode
    let itemsMap = new Map();

    for (const material of materialRequests) {
      for (const item of material.items) {
        const { _id: itemId, requestedQty } = item;

        // Try to find siteInventory
        let siteInventory = await siteInventoryModel
          .findOne({
            itemId: itemId,
            siteId: siteId, // Use null for center store incharge
          })
          .populate({
            path: "itemId",
            select: "itemCode category description uom",
          });

        let itemCode, category, description, uom;
        if (!siteInventory) {
          // Fallback to ItemModel if no siteInventory found
          let itemData = await ItemModel.findById(itemId).select(
            "itemCode category description uom"
          );
          if (!itemData) continue;
          itemCode = itemData.itemCode;
          category = itemData.category;
          description = itemData.description;
          uom = itemData.uom;
        } else {
          itemCode = siteInventory.itemId.itemCode;
          category = siteInventory.itemId.category;
          description = siteInventory.itemId.description;
          uom = siteInventory.itemId.uom;
        }

        // Check if item already exists in the map by itemCode
        if (itemsMap.has(itemCode)) {
          // Combine quantities for existing item
          const existingItem = itemsMap.get(itemCode);
          existingItem.requestedQty += requestedQty || 0;
          existingItem.pending = Math.max(
            0,
            existingItem.requestedQty - existingItem.issuedQuantity
          );
          itemsMap.set(itemCode, existingItem);
        } else {
          if (!siteInventory) {
            itemsMap.set(itemCode, {
              _id: itemId,
              itemCode: itemCode,
              category: category,
              description: description,
              uom: uom,
              requestedQty: requestedQty || 0,
              issuedQuantity: 0,
              pending: Math.max(0, (requestedQty || 0) - 0),
            });
          } else {
            let pending = Math.max(
              0,
              (requestedQty || 0) - (siteInventory.issuedQuantity || 0)
            );
            itemsMap.set(itemCode, {
              _id: itemId,
              itemCode: itemCode,
              category: category,
              description: description,
              uom: uom,
              requestedQty: requestedQty || 0,
              issuedQuantity: siteInventory.issuedQuantity || 0,
              pending: pending,
            });
          }
        }
      }
    }

    // Convert Map values to array
    let responseData = Array.from(itemsMap.values());

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get("/approved-PO", protect, async (req, res, next) => {
  try {
    let userId = req.user._id;

    const materialRequests = await MaterialRequestModel.find({
      requestedTo: userId,
      status: "approved",
      materialRequestNo: {
        $nin: await PurchaseModel.distinct("materialRequestNo"),
      },
    })
      .populate({
        path: "requestedBy",
        select: "name",
      })
      .populate({
        path: "requestedTo",
        select: "name",
      })
      .populate({
        path: "siteId",
        select: "siteName",
      })
      .sort({ createdAt: -1 });

    let responseData = [];

    for (const material of materialRequests) {
      let materialObj = material.toObject();

      let enrichedItems = [];
      for (const item of material.items) {
        const { _id: itemId, requestedQty } = item;
        let itemData = await ItemModel.findById(itemId).select(
          "itemCode category description uom"
        );

        enrichedItems.push({
          _id: itemId,
          itemCode: itemData?.itemCode || "",
          category: itemData?.category || "",
          description: itemData?.description || "",
          uom: itemData?.uom || "",
          requestedQty: requestedQty,
        });
      }
      materialObj.items = enrichedItems;
      responseData.push(materialObj);
    }

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
});

async function generateMaterialRequestNo() {
  const lastRequest = await MaterialRequestModel.findOne().sort({
    createdAt: -1,
  });
  let newNumber = 1;

  if (lastRequest && lastRequest.materialRequestNo) {
    const lastNum = parseInt(
      lastRequest.materialRequestNo.replace("MR-", ""),
      10
    );
    if (!isNaN(lastNum)) {
      newNumber = lastNum + 1;
    }
  }
  return `MR-${String(newNumber).padStart(4, "0")}`;
}

module.exports = router;
