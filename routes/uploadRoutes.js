const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/multerConfig'); // Import multer configuration
const {protect, authorizeRoles} = require('../middleware/authMiddleware');
// Route to handle file upload
router.post('/upload', upload, (req, res) => {
  try {
    // If files are uploaded successfully, send back the URLs
    const fileUrls = req.files.map((file) => file.path); // Extract URLs from Cloudinary response
    res.status(200).json({
      message: 'Files uploaded successfully!',
      fileUrls: fileUrls,  // Return an array of URLs
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error uploading files',
      error: error.message,
    });
  }
});

module.exports = router;
