const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const {
  registerUser,
  verifyEmail,
  loginUser,
  updateEmailVerificationStatus
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   POST /api/users/register
// @desc    Register user
// @access  Public
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
// @desc    Login user
// @access  Public
router.post(
  '/login',
  loginUser
);

// @route   GET /api/users/verifyemail/:token
// @desc    Verify user email
// @access  Public
router.get('/verifyemail/:token', verifyEmail);

// @route   POST /api/users/verify-email
// @desc    Update backend email verification status (for Firebase sync)
// @access  Private
router.post('/verify-email', protect, updateEmailVerificationStatus);

// @route   GET /api/users/profile
// @desc    Get current user's profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update current user's profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { firstName, lastName, phone, zipCode, address, profilePicture, bannerImage } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (zipCode !== undefined) user.zipCode = zipCode;
    if (address !== undefined) user.address = address;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (bannerImage !== undefined) user.bannerImage = bannerImage;

    await user.save();
    
    const updatedUser = await User.findById(req.user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a password (Firebase users may not)
    if (user.password) {
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/2fa
// @desc    Toggle 2FA
// @access  Private
router.put('/2fa', protect, async (req, res) => {
  try {
    const { enable } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2FA implementation would go here
    // For now, just acknowledge the request
    res.json({ 
      message: enable ? '2FA enabled' : '2FA disabled',
      is2FAEnabled: enable 
    });
  } catch (error) {
    console.error('Error toggling 2FA:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
