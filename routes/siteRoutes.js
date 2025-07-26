const express = require('express');
const router = express.Router();
const Site = require('../models/Site');

const {protect, authorizeRoles} = require('../middleware/authMiddleware');

// Get all sites
router.get('/get-all-sites', async (req, res) => {
  try {
    const sites = await Site.find();
    res.json({ success: true, sites });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sites' });
  }
});

// Add multiple sites
router.post('/add-sites', async (req, res) => {
  try {
    const { sites } = req.body;
    if (!sites || !Array.isArray(sites) || sites.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid sites data' });
    }

    // Validate Central Ware House
    const existingCentral = await Site.findOne({ hierarchy: 'Central Ware House' });
    const newSites = sites.filter(site => 
      !existingCentral || site.hierarchy !== 'Central Ware House'
    );

    if (newSites.length === 0) {
      return res.status(400).json({ success: false, message: 'Central Ware House already exists' });
    }

    const savedSites = await Site.insertMany(newSites);
    res.json({ success: true, sites: savedSites });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding sites' });
  }
});

// Update a site
router.put('/update-site/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate Central Ware House
    if (updates.hierarchy === 'Central Ware House') {
      const existingCentral = await Site.findOne({ 
        hierarchy: 'Central Ware House',
        _id: { $ne: id }
      });
      if (existingCentral) {
        return res.status(400).json({ 
          success: false, 
          message: 'Central Ware House already exists' 
        });
      }
    }

    const site = await Site.findByIdAndUpdate(id, updates, { 
      new: true, 
      runValidators: true 
    });
    if (!site) {
      return res.status(404).json({ success: false, message: 'Site not found' });
    }
    res.json({ success: true, site });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating site' });
  }
});

// Delete sites
router.post('/delete-sites', protect, async (req, res) => {
  try {
    const { siteIds } = req.body;
    if (!siteIds || !Array.isArray(siteIds) || siteIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid site IDs' });
    }

    const result = await Site.deleteMany({ _id: { $in: siteIds } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'No sites found to delete' });
    }
    res.json({ success: true, message: `${result.deletedCount} sites deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting sites' });
  }
});



module.exports = router;