const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const cloudinary = require('cloudinary').v2;

// @desc    Generate Cloudinary signature for secure uploads
// @route   POST /api/cloudinary/sign
// @access  Private (but accessible to any authenticated user for profile uploads)
router.post('/sign', protect, (req, res) => {
  try {
    const { folder } = req.body;
    
    if (!folder) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: folder,
      },
      cloudinary.config().api_secret
    );

    res.json({
      signature,
      timestamp,
      cloud_name: cloudinary.config().cloud_name,
      api_key: cloudinary.config().api_key,
    });
  } catch (error) {
    console.error('Cloudinary signature error:', error);
    res.status(500).json({ message: 'Error generating Cloudinary signature' });
  }
});

module.exports = router;
