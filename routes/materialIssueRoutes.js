const express = require("express");
const router = express.Router();
const MaterialIssueModel = require("../models/MaterialIssue");
const MaterialRequestModel = require("../models/MaterialRequest");
const ItemModel = require("../models/Item")
const { protect } = require("../middleware/authMiddleware");
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
      item : new mongoose.Types.ObjectId(i._id),
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

    res.status(201).json({
      success: true,
      message: "Material Issue created successfully",
      data: newIssue,
    });
  } catch (error) {
    console.error("Error creating material issue:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
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

    // get all approved materialRequests for given site
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
          let itemData = await ItemModel.findById(itemId).select( "itemCode category description uom");
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

module.exports = router;
