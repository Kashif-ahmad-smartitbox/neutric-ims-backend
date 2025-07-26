const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unitName: {
    type: String,
    required: [true, 'Unit name is required'],
    trim: true,
    unique: true,
  },
  unitDescription: {
    type: String,
    required: [true, 'Unit description is required'],
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Unit', unitSchema);