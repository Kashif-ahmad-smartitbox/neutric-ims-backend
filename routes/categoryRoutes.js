const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const {protect, authorizeRoles} = require('../middleware/authMiddleware');

// Get all categories
router.get('/get-all-categories',  async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json({ success: true, categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add categories
router.post('/add-categories',  async (req, res) => {
  try {
    const { categories } = req.body;
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ success: false, message: 'No categories provided' });
    }

    const newCategories = [];
    for (const cat of categories) {
      const existingCategory = await Category.findOne({ category: cat.category });
      if (existingCategory) {
        continue; // Skip duplicates
      }
      newCategories.push({
        category: cat.category,
        categoryDescription: cat.categoryDescription,
      });
    }

    if (newCategories.length === 0) {
      return res.status(400).json({ success: false, message: 'All provided categories already exist' });
    }

    const insertedCategories = await Category.insertMany(newCategories);
    res.json({ success: true, categories: insertedCategories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a category
router.put('/update-category/:id', async (req, res) => {
  try {
    const { category, categoryDescription } = req.body;
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { category, categoryDescription },
      { new: true, runValidators: true }
    );
    if (!updatedCategory) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, category: updatedCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete categories
router.post('/delete-categories',  async (req, res) => {
  try {
    const { categoryIds } = req.body;
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No category IDs provided' });
    }

    const result = await Category.deleteMany({ _id: { $in: categoryIds } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'No categories found to delete' });
    }
    res.json({ success: true, message: `${result.deletedCount} categories deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;