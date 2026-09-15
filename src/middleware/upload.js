const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vico',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  },
});

// 5MB per file cap keeps things sane on a free Cloudinary tier
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = upload;
