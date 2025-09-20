const express = require('express');
const router = express.Router();
const SubCategory = require('../models/SubCategory');
const { protect } = require('../middleware/authMiddleware');

// Get all subcategories
router.get('/', protect, async (req, res) => {
  try {
    const subs = await SubCategory.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, subCategories: subs });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create subcategory
router.post('/', protect, async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const existing = await SubCategory.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Sub category already exists' });
    }
    const sub = await SubCategory.create({ name: name.trim(), category: category || '' });
    res.status(201).json({ success: true, subCategory: sub });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update subcategory
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const sub = await SubCategory.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!sub) return res.status(404).json({ success: false, message: 'Sub category not found' });
    res.status(200).json({ success: true, subCategory: sub });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete subcategory
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await SubCategory.findByIdAndDelete(id);
    if (!sub) return res.status(404).json({ success: false, message: 'Sub category not found' });
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
