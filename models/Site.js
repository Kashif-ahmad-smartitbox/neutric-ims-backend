const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  siteName: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true,
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
  },
  projectCode: {
    type: String,
    required: [true, 'Project code is required'],
    trim: true,
    unique: true,
  },
  hierarchy: {
    type: String,
    required: [true, 'Hierarchy is required'],
    enum: ['Central Ware House', 'Site'],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Site', siteSchema);