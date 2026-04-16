const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const {
  registerUser,
  verifyEmail,
  loginUser,
  updateEmailVerificationStatus,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   POST /api/users/register
router.post(
  '/register',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('firstName', 'First name is required').not().isEmpty(),
  ],
  registerUser
);

// @route   POST /api/users/login
router.post('/login', loginUser);

// @route   GET /api/users/verifyemail/:token
router.get('/verifyemail/:token', verifyEmail);

// @route   POST /api/users/verify-email
router.post('/verify-email', protect, updateEmailVerificationStatus);

// @desc    Get user's favorite contractors (SYNCED WITH WEB)
// @route   GET /api/users/favorites
// @access  Private
router.get('/favorites', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('savedContractors');
    if (user) {
      res.json(user.savedContractors || []);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Toggle favorite contractor (SYNCED WITH WEB)
// @route   POST /api/users/favorite/:id
// @access  Private
router.post('/favorite/:id', protect, async (req, res) => {
  try {
    const contractorId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(contractorId)) {
      return res.status(400).json({ message: 'Invalid contractor ID' });
    }

    const user = await User.findById(req.user._id);
    if (user) {
      const isFavorited = user.savedContractors.includes(contractorId);
      if (isFavorited) {
        user.savedContractors = user.savedContractors.filter(id => id.toString() !== contractorId);
      } else {
        user.savedContractors.push(contractorId);
      }
      await user.save();
      res.json({ 
        message: isFavorited ? 'Removed from favorites' : 'Added to favorites',
        isFavorited: !isFavorited,
        favorites: user.savedContractors 
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Update current user's profile (INCLUDES PUSH TOKEN SYNC)
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, phone, zipCode, address, profilePicture, bannerImage, pushToken } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (zipCode !== undefined) user.zipCode = zipCode;
    if (address !== undefined) user.address = address;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (bannerImage !== undefined) user.bannerImage = bannerImage;
    
    // Support saving push token during profile update to avoid 404s on missing dedicated route
    if (pushToken !== undefined) {
      user.pushToken = pushToken;
    }

    await user.save();
    const updatedUser = await User.findById(req.user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Save push notification token (SYNCED WITH PRODUCTION)
// @route   POST /api/users/push-token
// @access  Private
router.post('/push-token', protect, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);

    if (user) {
      user.pushToken = token || '';
      await user.save();
      res.json({ message: 'Push token saved successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
