const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    required: [true, 'Item code is required'],
    trim: true,
    unique: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  uom: {
    type: String,
    required: [true, 'Unit of measurement is required'],
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
  },
  gst: {
    type: Number,
    required: [true, 'GST percentage is required'],
    min: [0, 'GST percentage cannot be negative'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Item', itemSchema);