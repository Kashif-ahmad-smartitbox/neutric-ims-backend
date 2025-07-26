// multerConfig.js
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer to use Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    // Dynamically set folder based on file type (you can modify this logic)
    let folder = 'uploads';  // Default folder
    if (file.mimetype.startsWith('image/')) {
      folder = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      folder = 'videos';
    } else if (file.mimetype === 'application/pdf') {
      folder = 'pdfs';
    }

    return {
      folder: folder, // Specify the folder in Cloudinary based on file type
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'avi', 'pdf'], // Add more formats as needed
    };
  },
});

const upload = multer({ storage: storage }).any(); // Use `.any()` to allow multiple fields

module.exports = { upload };
