const express = require("express");
const router = express.Router();
const InventoryModel = require("../models/Inventotry");
const siteInventoryModel = require("../models/SiteInventory");
const MaterialRequestModel = require("../models/MaterialRequest")

const ItemsModel = require("../models/Item");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/add-opening-stock", protect, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins are not allowed to perform this action.",
      });
    }

    const { stockData } = req.body; 
    const siteId = req.user.site;

    if (!Array.isArray(stockData) || stockData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide stockData as a non-empty array",
      });
    }

    let results = [];

    for (let stock of stockData) {
      const { itemId, open } = stock;

      const siteInventory = await siteInventoryModel.findOneAndUpdate(
        { itemId, siteId },
        { 
          $inc: { open: open, inHand: open },
          $setOnInsert: { siteId, itemId } // set only when creating
        },
        { new: true, upsert: true }
      );

      await InventoryModel.findOneAndUpdate(
        { itemId },
        { 
          $inc: { open: open, inHand: open },
          $setOnInsert: { itemId } 
        },
        { new: true, upsert: true }
      );

      results.push({
        itemId,
        siteData: siteInventory
      });
    }

    return res.status(201).json({
      success: true,
      message: "Stock data processed successfully",
      results,
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
    let baseQuery = {};
    if (req.user.role !== "admin") {
      baseQuery.siteId = req.user.site;
    }

    const approvedRequests = await MaterialRequestModel.find({
      siteId: baseQuery.siteId || { $exists: true },
      status: "approved",
    });

    const approvedItemIds = approvedRequests.flatMap((reqDoc) =>
      reqDoc.items.map((it) => it._id.toString())
    );

    const query = {
      ...baseQuery,
      $or: [
        { requestQuantity: 0 },
        { itemId: { $in: approvedItemIds } },
      ],
    };

    const siteInventories = await siteInventoryModel
      .find(query)
      .populate({
        path: "itemId",
        select: "itemCode description uom category",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: siteInventories,
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
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


router.get('/get-all-inHandTotal', async (req, res) => {
  try {
    const result = await siteInventoryModel.aggregate([
      {
        $lookup: {
          from: "items",
          localField: "itemId",
          foreignField: "_id",
          as: "itemData"
        }
      },
      { $unwind: "$itemData" },
      {
        $lookup: {
          from: "sites", 
          localField: "siteId",
          foreignField: "_id",
          as: "siteData"
        }
      },
      { $unwind: "$siteData" },
      {
        $group: {
          _id: "$itemId",
          itemCode: { $first: "$itemData.itemCode" },
          description: { $first: "$itemData.description" },
          uom: { $first: "$itemData.uom" },
          category: { $first: "$itemData.category" },
          sites: {
            $push: {
              siteId: "$siteId",
              siteName: "$siteData.siteName",
              qty: "$inHand"
            }
          },
          totalQty: { $sum: "$inHand" }
        }
      },
      { $sort: { itemCode: 1 } }
    ]);

    res.status(200).json({
      status: true,
      message: "In-Hand Totals fetched successfully",
      data: result
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message
    });
  }
});




module.exports = router;
