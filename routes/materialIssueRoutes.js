const express = require("express");
const router = express.Router();
const MaterialIssueModel = require("../models/MaterialIssue");
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
