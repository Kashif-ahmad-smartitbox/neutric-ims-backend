const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
  },
  categoryDescription: {
    type: String,
    required: [true, 'Category description is required'],
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Category', categorySchema);