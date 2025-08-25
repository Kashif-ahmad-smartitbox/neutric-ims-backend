const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const Category = require('../models/Category');
const Unit = require('../models/Unit');
const generateItemCodes = require("../utils/generateItemCodes");
// Get all items
router.get('/get-all-items',protect , async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add items (single or bulk)
router.post("/add-items",protect , async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No items provided" });
    }
    const newItems = await Item.insertMany(items ,  { ordered: false });
    const latestItem = await Item.findOne().sort({ itemCode: -1 });

    res.status(201).json({
      success: true,
      items: newItems,
      latestCode: latestItem?.itemCode || null,
    });
  } catch (error) {
    console.error("Error adding items:", error);
    if (error.code === 11000) {
      res
        .status(400)
        .json({ success: false, message: "Duplicate item code found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
});


router.put('/update-item/:id',protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const item = await Item.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    console.error('Error updating item:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Duplicate item code found' });
    } else {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
});

router.post('/delete-items',protect , async (req, res) => {
  try {
    const { itemIds } = req.body;
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No item IDs provided' });
    }

    const result = await Item.deleteMany({ _id: { $in: itemIds } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'No items found to delete' });
    }

    res.status(200).json({ success: true, message: 'Items deleted successfully' });
  } catch (error) {
    console.error('Error deleting items:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all units
router.get('/units', async (req, res) => {
  try {
    const units = await Unit.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, units });
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


module.exports = router;