const express = require('express');
const router = express.Router();
const Unit = require('../models/Unit');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');


router.get('/get-all-units', async (req, res) => {
  try {
    const units = await Unit.find().sort({ createdAt: -1 });
    res.json({ success: true, units });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post("/add-units", async (req, res) => {
  try {
    const { units } = req.body;
    if (!units || !Array.isArray(units)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid units data" });
    }

    const chunkSize = 1000;
    const chunks = chunkArray(units, chunkSize);

    let insertedUnits = [];

    for (const chunk of chunks) {
      const inserted = await Unit.insertMany(chunk, { ordered: false });
      insertedUnits = insertedUnits.concat(inserted);
    }

    res.json({
      success: true,
      totalInserted: insertedUnits.length,
    });
  } catch (error) {
    console.error("Error inserting units:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put('/update-unit/:id', async (req, res) => {
  try {
    const { unitName, unitDescription } = req.body;
    const unit = await Unit.findByIdAndUpdate(
      req.params.id,
      { unitName, unitDescription },
      { new: true, runValidators: true }
    );
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Unit not found' });
    }
    res.json({ success: true, unit });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/delete-units', async (req, res) => {
  try {
    const { unitIds } = req.body;
    if (!unitIds || !Array.isArray(unitIds)) {
      return res.status(400).json({ success: false, message: 'Invalid unit IDs' });
    }

    const result = await Unit.deleteMany({ _id: { $in: unitIds } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
module.exports = router;