const express = require("express");
const router = express.Router();
const siteInventoryModel = require("../models/SiteInventory");
const MaterialRequestModel = require("../models/MaterialRequest");
const MaterialIssueModel = require("../models/MaterialIssue");
const SiteModel = require("../models/Site");

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

    // Get all inventory for the site (no filtering based on material requests)
    const siteInventories = await siteInventoryModel
      .find(baseQuery)
      .populate({
        path: "itemId",
        select: "itemCode description uom category",
      })
      .sort({ createdAt: -1 });

    // Calculate pending quantity for each inventory item
    const inventoriesWithPending = siteInventories.map(inventory => {
      const pending = Math.max(0, inventory.requestQuantity - inventory.inHand);
      return {
        ...inventory.toObject(),
        pending: pending
      };
    });

    res.status(200).json({
      success: true,
      data: inventoriesWithPending,
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// router.get("/get-all-inventory", protect, async (req, res) => {
//   try {
//     let baseQuery = {};
//     if (req.user.role !== "admin") {
//       baseQuery.siteId = req.user.site;
//     }

//     const approvedRequests = await MaterialRequestModel.find({
//       siteId: baseQuery.siteId || { $exists: true },
//       status: "approved",
//     });


//     const approvedItemIds = approvedRequests.flatMap((reqDoc) =>
//       reqDoc.items.map((it) => it._id.toString())
//     );

//     const query = {
//       ...baseQuery,
//       $or: [
//         // { requestQuantity: 0 },
//         { itemId: { $in: approvedItemIds } },
//       ],
//     };


//     const siteInventories = await siteInventoryModel
//       .find(query)
//       .populate({
//         path: "itemId",
//         select: "itemCode description uom category",
//       })
//       .sort({ createdAt: -1 });

//     // Calculate pending quantity for each inventory item
//     const inventoriesWithPending = siteInventories.map(inventory => {
//       const pending = Math.max(0, inventory.requestQuantity - inventory.issuedQuantity);
//       return {
//         ...inventory.toObject(),
//         pending: pending
//       };
//     });

//     res.status(200).json({
//       success: true,
//       data: inventoriesWithPending,
//     });
//   } catch (error) {
//     console.error("Error fetching inventory:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// });

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
          subCategory: { $first: "$itemData.subCategory" },
          openingStock: { $first: "$itemData.openingStock" },
          lastPurchasePrice: { $first: "$itemData.lastPurchasePrice" },
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



router.post('/get-stock', protect, async (req, res) => {
  try {
    const { itemCodes } = req.body;

    if (!itemCodes || !Array.isArray(itemCodes) || itemCodes.length === 0) {
      return res.status(400).json({
        status: false,
        message: "itemCodes array is required"
      });
    }

    const result = await siteInventoryModel.find({
      siteId: req.user.site,
      itemId: { $in: itemCodes }
    });

    res.status(200).json({
      status: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message
    });
  }
});





// Get composed in-hand inventory - Only admin and center store incharge can access
router.get('/get-composed-inventory', protect, authorizeRoles('admin', 'center store incharge'), async (req, res) => {
  try {
    // Extract query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'itemCode';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    

    
    // Get all sites for the response structure
    const sites = await SiteModel.find({}, 'siteName _id').sort({ siteName: 1 });
    
    // Build search query for items
    let itemSearchQuery = {};
    if (search) {
      itemSearchQuery = {
        $or: [
          { itemCode: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { subCategory: { $regex: search, $options: 'i' } },
          { uom: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Get total count for pagination
    const totalItems = await ItemsModel.countDocuments(itemSearchQuery);
    const totalPages = Math.ceil(totalItems / limit);
    
    // Get items with pagination and search
    const items = await ItemsModel.find(itemSearchQuery, 'itemCode description uom category subCategory openingStock lastPurchasePrice')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);
    
    // Get item IDs for the current page
    const itemIds = items.map(item => item._id);
    
    // Get site inventories only for the current page items - Use aggregation to filter invalid ObjectIds
    const allSiteInventoriesAggregation = await siteInventoryModel.aggregate([
      {
        $match: {
          itemId: { $exists: true, $ne: null, $type: "objectId", $in: itemIds }
        }
      },
      {
        $lookup: {
          from: "items",
          localField: "itemId",
          foreignField: "_id",
          as: "itemData"
        }
      },
      {
        $match: {
          "itemData.0": { $exists: true }
        }
      },
      {
        $addFields: {
          itemId: { $arrayElemAt: ["$itemData", 0] }
        }
      },
      {
        $project: {
          itemData: 0
        }
      }
    ]);
    
    
    // Separate regular site inventories from center warehouse (siteId: null)
    const siteInventories = allSiteInventoriesAggregation.filter(inv => inv.siteId !== null);
    const centerStoreInventories = allSiteInventoriesAggregation.filter(inv => inv.siteId === null);
    

    
    // Get all material issues to calculate issued quantities
    const materialIssues = await MaterialIssueModel.find({}).populate('items.item', 'itemCode');
    
    // Create a map to store total issued quantities per item per site
    const issuedQuantitiesMap = new Map();
    
    // Process material issues to calculate issued quantities
    materialIssues.forEach(issue => {
      // Skip if issuedTo is null or undefined
      if (!issue.issuedTo) return;
      
      const siteId = issue.issuedTo.toString();
      issue.items.forEach(item => {
        // Skip if item or item._id is null/undefined
        if (!item || !item.item || !item.item._id) return;
        
        const itemId = item.item._id.toString();
        const key = `${itemId}-${siteId}`;
        const currentQty = issuedQuantitiesMap.get(key) || 0;
        issuedQuantitiesMap.set(key, currentQty + item.issueQty);
      });
    });
    
    // Create a map to store site inventories
    const siteInventoryMap = new Map();
    let validSiteInventoryCount = 0;
    let skippedSiteInventoryCount = 0;
    
    siteInventories.forEach(inv => {
      // Skip if required fields are null/undefined
      if (!inv || !inv.itemId || !inv.itemId._id || !inv.siteId) {
        skippedSiteInventoryCount++;
        if (skippedSiteInventoryCount <= 5) { // Only log first 5 skipped records
          console.log('Skipping invalid site inventory record:', inv);
        }
        return;
      }
      
      // Validate ObjectId format
      try {
        const itemIdStr = inv.itemId._id.toString();
        const siteIdStr = inv.siteId.toString();
        
        // Check if ObjectId strings are valid (24 character hex string)
        if (!/^[0-9a-fA-F]{24}$/.test(itemIdStr) || !/^[0-9a-fA-F]{24}$/.test(siteIdStr)) {
          skippedSiteInventoryCount++;
          if (skippedSiteInventoryCount <= 5) {
            console.log('Skipping record with invalid ObjectId format:', { itemId: itemIdStr, siteId: siteIdStr });
          }
          return;
        }
        
        const key = `${itemIdStr}-${siteIdStr}`;
        siteInventoryMap.set(key, inv);
        validSiteInventoryCount++;
      } catch (error) {
        skippedSiteInventoryCount++;
        if (skippedSiteInventoryCount <= 5) {
          console.log('Error processing site inventory record:', error.message, inv);
        }
        return;
      }
    });
    
   
    
    // Create a map to store center store inventories (siteId: null)
    const centerStoreInventoryMap = new Map();
    let validCenterStoreCount = 0;
    let skippedCenterStoreCount = 0;
    
    centerStoreInventories.forEach(inv => {
      // Skip if required fields are null/undefined
      if (!inv || !inv.itemId || !inv.itemId._id) {
        skippedCenterStoreCount++;
        return;
      }
      
      // Validate ObjectId format
      try {
        const itemIdStr = inv.itemId._id.toString();
        
        // Check if ObjectId string is valid (24 character hex string)
        if (!/^[0-9a-fA-F]{24}$/.test(itemIdStr)) {
          skippedCenterStoreCount++;
          if (skippedCenterStoreCount <= 5) {
            console.log('Skipping center store record with invalid ObjectId format:', { itemId: itemIdStr });
          }
          return;
        }
        
        const key = `${itemIdStr}-center`;
        centerStoreInventoryMap.set(key, inv);
        validCenterStoreCount++;
      } catch (error) {
        skippedCenterStoreCount++;
        if (skippedCenterStoreCount <= 5) {
          console.log('Error processing center store record:', error.message, inv);
        }
        return;
      }
    });
    

    
    // Process each item to create the composed inventory
    const composedInventory = items.map(item => {
      const itemId = item._id.toString();
      const sitesData = {};
      let totalInHand = 0;
      
      // Process each site for this item
      sites.forEach(site => {
        // Skip if site or site._id is null/undefined
        if (!site || !site._id) return;
        
        const siteId = site._id.toString();
        const key = `${itemId}-${siteId}`;
        
        // Get site inventory (opening stock)
        const siteInventory = siteInventoryMap.get(key);
        const openingStock = siteInventory ? siteInventory.inHand : 0;
        
        // Get issued quantity for this item at this site
        const issuedQty = issuedQuantitiesMap.get(key) || 0;
        
        // Calculate in-hand: opening stock - material issue
        const inHand = Math.max(0, openingStock - issuedQty);
        
        sitesData[siteId] = inHand;
        totalInHand += inHand;
      });
      
      // Handle center store inventory (where siteId is null)
      const centerKey = `${itemId}-center`;
      const centerInventory = centerStoreInventoryMap.get(centerKey);
      if (centerInventory) {
        const centerOpeningStock = centerInventory.inHand || centerInventory.open || 0;
        // For center store, we don't subtract issued quantities as it's the source
        const centerInHand = centerOpeningStock;
        sitesData['center'] = centerInHand;
        totalInHand += centerInHand;
      }
      
      // Determine unit price: prefer lastPurchasePrice if > 0, otherwise fall back to openingStock
      const unitPrice = (item.lastPurchasePrice && item.lastPurchasePrice > 0) ? item.lastPurchasePrice : (item.openingStock || 0);

      return {
        _id: item._id,
        itemCode: item.itemCode,
        description: item.description,
        uom: item.uom,
        category: item.category,
        subCategory: item.subCategory || '',
        openingStock: item.openingStock || 0,
        lastPurchasePrice: item.lastPurchasePrice || 0,
        unitPrice,
        totalInHand: totalInHand,
        totalValue: parseFloat((unitPrice * totalInHand).toFixed(2)),
        sites: sitesData
      };
    });
    

    
    res.status(200).json({
      success: true,
      message: "Composed inventory fetched successfully",
      data: {
        inventory: composedInventory,
        sites: sites,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null
        },
        search: {
          query: search,
          resultsCount: composedInventory.length
        },
        sort: {
          by: sortBy,
          order: sortOrder === 1 ? 'asc' : 'desc'
        }
      },
      debug: {
        totalSiteInventories: siteInventories.length,
        validSiteInventories: validSiteInventoryCount,
        skippedSiteInventories: skippedSiteInventoryCount,
        totalCenterStoreInventories: centerStoreInventories.length,
        validCenterStoreInventories: validCenterStoreCount,
        skippedCenterStoreInventories: skippedCenterStoreCount,
        totalItems: items.length,
        totalComposedItems: composedInventory.length
      }
    });
    
  } catch (error) {
    console.error("Error fetching composed inventory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
});

module.exports = router;
