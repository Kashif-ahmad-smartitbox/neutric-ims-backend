const express = require("express");
const router = express.Router();
const InventoryModel = require("../models/Inventotry");
const siteInventoryModel = require("../models/SiteInventory");

const ItemsModel = require("../models/Item");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/add-opening-stock", protect, async (req, res) => {
  try {
    const { itemId, open } = req.body;
    const siteId = req.user.site;

    const findItemInSite = await siteInventoryModel.findOne({ itemId, siteId });

    if (findItemInSite) {
      return res.status(400).json({
        success: false,
        message: "This Item already present for this site",
      });
    }

    await siteInventoryModel.create({
      itemId,
      open,
      inHand: open,
      siteId,
    });

   
    const inventory = await InventoryModel.findOneAndUpdate(
      { itemId },
      { 
        $inc: { open: open, inHand: open }
      },
      { new: true, upsert: true } 
    );

    res.status(201).json({
      success: true,
      message: "Inventory created/updated successfully",
      data: inventory,
    });
  } catch (error) {
    console.error("Error creating/updating Inventory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});



router.get("/get-all-inventory", protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== "admin") {
      query.siteId = req.user.site;
    }

    const requests = await InventoryModel.find(query)
      .populate({
        path: "itemId",
        select: "itemCode description uom category",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// router.patch("/update/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { itemId, open, inHand, requestQuantity, issuedQuantity, mip, pending } = req.body;

//     const updateFields = {};
//     if (itemId !== undefined) updateFields.itemId = itemId;
//     if (open !== undefined) updateFields.open = open;
//     if (inHand !== undefined) updateFields.inHand = inHand;
//     if (requestQuantity !== undefined) updateFields.requestQuantity = requestQuantity;
//     if (issuedQuantity !== undefined) updateFields.issuedQuantity = issuedQuantity;
//     if (mip !== undefined) updateFields.mip = mip;
//     if (pending !== undefined) updateFields.pending = pending;

//     const updatedInventory = await InventoryModel.findByIdAndUpdate(
//       id,
//       { $set: updateFields },
//       { new: true, runValidators: true }
//     ).populate({
//       path: "itemId",
//       select: "itemCode description uom category gst",
//     });

//     if (!updatedInventory) {
//       return res.status(404).json({
//         success: false,
//         message: "Inventory record not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Inventory updated successfully",
//       data: updatedInventory,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// });

// router.delete("/delete/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const deletedInventory = await InventoryModel.findByIdAndDelete(id);

//     if (!deletedInventory) {
//       return res.status(404).json({
//         success: false,
//         message: "Inventory record not found",
//       });
//     }
//     res.status(200).json({
//       success: true,
//       message: "Inventory record deleted successfully",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// });

module.exports = router;
