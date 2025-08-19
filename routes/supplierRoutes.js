const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const supplierModel = require("../models/Supplier");

router.post("/add-suppliers",protect , async (req, res) => {
  try {
    const { suppliers } = req.body;
    if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Suppliers array is required and cannot be empty.",
      });
    }
    const emails = suppliers.map((s) => s.email.toLowerCase());
    const existingSuppliers = await supplierModel.find({
      email: { $in: emails },
    });

    if (existingSuppliers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Duplicate email(s) found: ${existingSuppliers
          .map((s) => s.email)
          .join(", ")}`,
      });
    }

    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate email(s) in request payload.",
      });
    }
    const insertedSuppliers = await supplierModel.insertMany(suppliers);
    res.status(201).json({
      success: true,
      message: `${insertedSuppliers.length} supplier(s) added successfully.`,
      suppliers: insertedSuppliers,
    });
  } catch (error) {
    console.error("Error adding suppliers:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

router.get("/get-all-suppliers",protect, async (req, res) => {
  try {
    const suppliers = await supplierModel.find().sort({ createdAt: -1 });
    res.json({ success: true, suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/update-supplier/:id",protect, async (req, res) => {
  try {
    const { email } = req.body;
    const existing = await supplierModel.findOne({
      email,
      _id: { $ne: req.params.id },
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already in use" });
    }
    const updated = await supplierModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });

    res.json({ success: true, message: "Supplier updated", supplier: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/delete-suppliers",protect, async (req, res) => {
  try {
    const { supplierIds } = req.body;
    if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "supplierIds must be a non-empty array.",
      });
    }
    const deleteResult = await supplierModel.deleteMany({
      _id: { $in: supplierIds },
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No suppliers found for the given IDs.",
      });
    }
    res.json({
      success: true,
      message: `${deleteResult.deletedCount} supplier(s) deleted successfully.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
