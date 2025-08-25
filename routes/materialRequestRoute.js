const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const MaterialRequestModel = require("../models/MaterialRequest");
const userModel = require("../models/User");
const InventoryModel = require("../models/Inventotry");
const siteInventoryModel = require("../models/SiteInventory");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/create", protect, async (req, res) => {
  try {
    let { siteId, items } = req.body;

    sitedId = req.user.site;
    let userId = req.user._id;

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

    // let existingRequest = await MaterialRequestModel.findOne({
    //   requestedBy: userId,
    //   status: "pending",
    // });

    // if (existingRequest) {
    //   for (const item of items) {
    //     const existingItem = existingRequest.items.find(
    //       (i) => i.itemId === item.itemId
    //     );
    //     if (existingItem) {
    //       existingItem.requestedQty += item.requestedQty;
    //     } else {
    //       existingRequest.items.push(item);
    //     }
    //   }

    //   await existingRequest.save();

    //   for (const item of items) {
    //     const { itemId, requestedQty } = item;

    //     await siteInventoryModel.findOneAndUpdate(
    //       { itemId, siteId },
    //       {
    //         $inc: {
    //           requestQuantity: requestedQty,
    //         },
    //         $setOnInsert: {
    //           open: 0,
    //           issuedQuantity: 0,
    //           mip: 0,
    //           inHand: 0,
    //         },
    //       },
    //       { new: true, upsert: true }
    //     );

    //     await InventoryModel.findOneAndUpdate(
    //       { itemId },
    //       {
    //         $inc: {
    //           requestQuantity: requestedQty,
    //         },
    //         $setOnInsert: {
    //           open: 0,
    //           issuedQuantity: 0,
    //           mip: 0,
    //           inHand: 0,
    //           siteId,
    //         },
    //       },
    //       { new: true, upsert: true }
    //     );
    //   }

    //   return res.status(200).json({
    //     success: true,
    //     message: "Material request updated successfully",
    //     data: existingRequest,
    //   });
    // }

    const materialRequest = await MaterialRequestModel.create({
      materialRequestNo,
      requestedBy: req.user.id,
      siteId,
      items,
    });

    for (const item of items) {
      const { itemId, requestedQty } = item;

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
    const requests = await MaterialRequestModel.find({
      siteId: new mongoose.Types.ObjectId(siteId),
    })
      .populate({
        path: "requestedBy",
        select: "name",
      })
      .populate({
        path: "siteId",
        select: "siteName",
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

router.get("/get-all-approve", protect, async (req, res) => {
  try {
    let siteId = req.user.site;
    if (req.user.role === "site store incharge") {
      const requests = await MaterialRequestModel.find({
        siteId: new mongoose.Types.ObjectId(siteId),
      })
        .populate({
          path: "requestedBy",
          select: "name",
        })
        .populate({
          path: "siteId",
          select: "siteName",
        })
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: requests });
    } else if (req.user.role === "center store incharge") {
      try {
        let allSiteStoreIncharge = await UserModel.find({
          role: "site store incharge",
        });
        let siteIds = allSiteStoreIncharge.map((u) => u.siteId);
        let requests = await MaterialRequestModel.find({
          siteId: { $in: siteIds },
        })
          .populate({
            path: "requestedBy",
            select: "name",
          })
          .populate({
            path: "siteId",
            select: "siteName",
          })
          .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: requests });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    } else if (req.user.role === "purchase manager") {
      try {
        let cneterStoreIncharge = await UserModel.find({
          role: "center store incharge",
        });

        const requests = await MaterialRequestModel.find({
          siteId: new mongoose.Types.ObjectId(cneterStoreIncharge.site),
        })
          .populate({
            path: "requestedBy",
            select: "name",
          })
          .populate({
            path: "siteId",
            select: "siteName",
          })
          .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: requests });
      } catch (err) {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

module.exports = router;
