const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const siteModel = require("../models/Site");
const itemsModel = require("../models/Item");
const siteInventoryModel = require("../models/SiteInventory");

router.post("/add", async (req, res) => {
  try {
    const { siteId, itemId, qty } = req.body;

    const site = await siteModel.findById(siteId);
    const item = await itemsModel.findById(itemId);

    if (!site) return res.status(404).json({ message: "Site not found" });
    if (!item) return res.status(404).json({ message: "Item not found" });

  
    const siteInventory =await siteInventoryModel.create({
      siteId,
      itemId,
      uom: item.unit,
      qty: Number(qty),
    });

    res.status(201).json({
      success: true,
     data : siteInventory,
    });
  } catch (error) {
    console.error("Error adding suppliers:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

module.exports = router;
