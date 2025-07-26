const multer = require('multer');
const path = require('path');

// Multer setup for handling image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/images'); // Set your image upload folder here
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Add a timestamp to avoid filename conflicts
    }
});

// Filter to only allow image files
const fileFilter = (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    }
    cb(new Error('Only image files are allowed'), false);
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// Export multer upload middleware to use in routes
module.exports = upload;
