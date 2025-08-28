const express = require("express");
const router = express.Router();
const MaterialIssueModel = require("../models/MaterialIssue");
const MaterialRequestModel = require("../models/MaterialRequest");
const SiteInventoryModel = require("../models/SiteInventory");
const ItemModel = require("../models/Item");
const TransferOrderModel = require("../models/TransferOrder");
const { protect } = require("../middleware/authMiddleware");
const SiteModel = require("../models/Site");
const mongoose = require("mongoose");

router.post("/create", protect, async (req, res) => {
  try {
    const {
      transferNo,
      vehicleNo,
      exitDateTime,
      items,
      issuedTo,
      destination,
    } = req.body;
    const { _id: userId, site: siteId } = req.user;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Items are required" });
    }

    const formattedItems = items.map((i) => ({
      item: new mongoose.Types.ObjectId(i._id),
      issueQty: i.issueQty,
    }));

    const materialIssueNumber = await generateMaterialIssueNumber();
    const newIssue = new MaterialIssueModel({
      items: formattedItems,
      materialIssueNumber,
      siteId,
      issuedBy: userId,
      issuedTo,
      shipmentDetails: {
        transferNo,
        vehicleNo,
        dateAndExitTime: exitDateTime,
        destination,
      },
    });

    await newIssue.save();
    for (let i of items) {
      const reqItem = await SiteInventoryModel.findOne({
        itemId: i._id,
        siteId: req.user.site,
      });

      if (!reqItem) continue;

      if (reqItem.inHand < i.issueQty) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for item ${reqItem.itemId}, available: ${reqItem.inHand}`,
        });
      }

      const newPending = reqItem.requestQuantity - i.issueQty;

      await SiteInventoryModel.findOneAndUpdate(
        { itemId: i._id, siteId: req.user.site },
        {
          $set: {
            issuedQuantity: (reqItem.issuedQuantity || 0) + i.issueQty,
            pending: newPending < 0 ? 0 : newPending,
          },
          $inc: {
            inHand: -i.issueQty,
          },
        },
        { new: true }
      );
    }
    if (vehicleNo) {
      const SiteData = await SiteModel.findById(issuedTo);
      let type;
      if (
        (req.body.issuedFrom.hierarchy === "Site" &&
          SiteData.hierarchy === "Central Ware House") ||
        req.body.issuedFrom.hierarchy === "Central Ware House"
      ) {
        type = "Transferred";
      }

      let transferNoGen = await generateTransferNo();

      const newOrder = new TransferOrderModel({
        transferNo: transferNoGen,
        materialIssueNo: materialIssueNumber,
        type,
        vehicleNumber: vehicleNo,
        from: req.user.site,
        to: destination._id,
        requestedBy: req.user._id,
        requestedTo: destination._id,
        exitDateTime: exitDateTime,
      });

      const savedOrder = await newOrder.save();

      newIssue.transferOrderId = savedOrder._id;
      await newIssue.save();
    }

    res.status(201).json({
      success: true,
      message: "Material Issue created successfully",
      data: newIssue,
    });
  } catch (error) {
    console.error("Error creating material issue:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
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

router.put("/update/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      issuedBy,
      issueTo,
      issuedFrom,
      transferNo,
      vehicleNo,
      exitDateTime,
      destination,
      issuedTo,
      items,
    } = req.body;

    let materialIssue = await MaterialIssueModel.findById(id);
    if (!materialIssue) {
      return res.status(404).json({ message: "Material Issue not found" });
    }
    materialIssue.issuedBy = issuedBy || materialIssue.issuedBy;
    materialIssue.issueTo = issueTo || materialIssue.issueTo;
    materialIssue.issuedFrom = issuedFrom || materialIssue.issuedFrom;
    materialIssue.transferNo = transferNo || materialIssue.transferNo;
    materialIssue.vehicleNo = vehicleNo || materialIssue.vehicleNo;
    materialIssue.exitDateTime = exitDateTime || materialIssue.exitDateTime;
    materialIssue.destination = destination || materialIssue.destination;
    materialIssue.issuedTo = issuedTo || materialIssue.issuedTo;

    if (items && items.length > 0) {
      items.forEach((updatedItem) => {
        const itemIndex = materialIssue.items.findIndex(
          (item) => item._id.toString() === updatedItem._id
        );

        if (itemIndex > -1) {
          materialIssue.items[itemIndex].issueQty = updatedItem.issueQty;
        } else {
          materialIssue.items.push(updatedItem);
        }
      });
    }
    const updatedIssue = await materialIssue.save();

    res.json({
      message: "Material Issue updated successfully",
      data: updatedIssue,
    });
  } catch (error) {
    console.error("Error updating Material Issue:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.post("/delete", async (req, res) => {
  try {
    const { issueIds } = req.body;

    if (!issueIds || !Array.isArray(issueIds) || issueIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "issueIds array is required" });
    }
    const invalidIds = issueIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID format: ${invalidIds.join(", ")}`,
      });
    }
    const result = await MaterialIssueModel.deleteMany({
      _id: { $in: issueIds },
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No material Issue found for the given IDs",
      });
    }

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} material Issues deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.get("/get-all-issue", protect, async (req, res) => {
  try {
    const { site: siteId, _id: userId } = req.user;

    const getMaterialIssue = await MaterialIssueModel.find({
      issuedBy: userId,
      // issuedTo: siteId,
    })
      .populate({
        path: "issuedBy",
        select: " _id name ",
      })
      .populate({
        path: "issuedTo",
        select: "siteName address state city",
      })
      .populate({
        path: "items.item",
        select: "itemCode description uom category gst",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: getMaterialIssue,
    });
  } catch (error) {
    console.error("Error fetching material issues:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/get-all-cw-issue/:id", protect, async (req, res, next) => {
  try {
    let userId = req.user._id;
    let siteId = req.user.site;

    let materialRequests = await MaterialRequestModel.find({
      requestedTo: userId,
      siteId: req.params.id,
      status: "approved",
    });

    let responseData = [];

    for (const material of materialRequests) {
      for (const item of material.items) {
        const { _id: itemId, requestedQty } = item;

        // 🔎 Try to find siteInventory
        let siteInventory = await SiteInventoryModel.findOne({
          itemId: itemId,
          siteId: siteId,
        }).populate({
          path: "itemId",
          select: "itemCode category description uom",
        });

        if (!siteInventory) {
          let itemData = await ItemModel.findById(itemId).select(
            "itemCode category description uom"
          );
          responseData.push({
            itemCode: itemData?.itemCode || "",
            category: itemData?.category || "",
            description: itemData?.description || "",
            uom: itemData?.uom || "",
            requestedQty: requestedQty || 0,
            issuedQuantity: 0,
            pending: 0 - (requestedQty || 0),
          });
        } else {
          let pending = siteInventory.open - requestedQty;
          responseData.push({
            itemCode: siteInventory.itemId.itemCode,
            category: siteInventory.itemId.category,
            description: siteInventory.itemId.description,
            uom: siteInventory.itemId.uom,
            requestedQty: requestedQty,
            inhand: siteInventory.inHand,
            issuedQuantity: siteInventory.issuedQuantity || 0,
            pending: pending,
          });
        }
      }
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

async function generateMaterialIssueNumber() {
  const lastIssue = await MaterialIssueModel.findOne().sort({ createdAt: -1 });

  if (!lastIssue || !lastIssue.materialIssueNumber) {
    return "MI-0001";
  }

  const lastNumber = parseInt(lastIssue.materialIssueNumber.split("-")[1], 10);
  const nextNumber = lastNumber + 1;

  return `MI-${String(nextNumber).padStart(4, "0")}`;
}

const generateTransferNo = async () => {
  const lastOrder = await TransferOrderModel.findOne().sort({ createdAt: -1 });
  if (!lastOrder) return "TO-0001";

  const lastNo = parseInt(lastOrder.transferNo.split("-")[1]) || 0;
  const newNo = (lastNo + 1).toString().padStart(4, "0");
  return `TO-${newNo}`;
};

module.exports = router;
