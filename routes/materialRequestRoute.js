const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const MaterialRequestModel = require("../models/MaterialRequest");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

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

router.post("/create", protect, async (req, res) => {
  try {
    let { materialRequestNo, siteId, items } = req.body;

    if (!materialRequestNo) {
      materialRequestNo = await generateMaterialRequestNo();
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
    }

    items = items.map((item) => ({
      ...item,
      requestedQty: Number(item.requestedQty),
    }));

    const existingRequest = await MaterialRequestModel.findOne({
      siteId: siteId,
      status: "pending",
      "items._id": { $in: items.map((i) => i._id) },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Material request with the same site and item already exists",
      });
    }

    const materialRequest = await MaterialRequestModel.create({
      materialRequestNo,
      requestedBy: req.user.id,
      siteId,
      items,
    });

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
    let siteId = req.user.site

    const requests = await MaterialRequestModel.find({siteId: new mongoose.Types.ObjectId(siteId)})
      .populate({
        path: "requestedBy",
        select: "name",
      })
      .populate({
        path : "siteId",
        select : "siteName"
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.patch("/update/:id", async (req, res) => {
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
      { requestedBy, siteId, items  , status  },
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

router.delete("/delete", async (req, res) => {
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

module.exports = router;
