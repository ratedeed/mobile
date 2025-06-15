const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const User = require('../models/User');
const generateToken = require('../utils/generateToken'); // Assuming this utility exists
const { protect } = require('../middleware/authMiddleware'); // Assuming this middleware exists

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  // In a real app, use bcrypt.compareSync(password, user.password)
  if (user && user.password === password) { // Placeholder for actual password comparison
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      bannerImage: user.bannerImage,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
}));

// @desc    Register a new user
// @route   POST /api/users/signup
// @access  Public
router.post('/signup', asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, zipCode } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    password, // Password should be hashed in a real application
    zipCode,
    role: 'user', // Default role for new signups
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      bannerImage: user.bannerImage,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
}));

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      zipCode: user.zipCode,
      profilePicture: user.profilePicture,
      bannerImage: user.bannerImage,
      is2FAEnabled: user.is2FAEnabled,
      isAdmin: user.isAdmin,
      role: user.role,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
}));

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;
    user.email = req.body.email || user.email;
    user.zipCode = req.body.zipCode || user.zipCode;
    user.profilePicture = req.body.profilePicture || user.profilePicture;
    user.bannerImage = req.body.bannerImage || user.bannerImage;

    if (req.body.password) {
      user.password = req.body.password; // Password should be hashed
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      zipCode: updatedUser.zipCode,
      profilePicture: updatedUser.profilePicture,
      bannerImage: updatedUser.bannerImage,
      is2FAEnabled: updatedUser.is2FAEnabled,
      isAdmin: updatedUser.isAdmin,
      role: updatedUser.role,
      token: generateToken(updatedUser._id),
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
}));

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
router.put('/change-password', protect, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  if (user && user.password === currentPassword) { // Placeholder for actual password comparison
    user.password = newPassword; // Password should be hashed
    await user.save();
    res.status(200).json({ message: 'Password changed successfully' });
  } else {
    res.status(401);
    throw new Error('Invalid current password');
  }
}));

// @desc    Toggle 2FA for user
// @route   PUT /api/users/2fa
// @access  Private
router.put('/2fa', protect, asyncHandler(async (req, res) => {
  const { enable } = req.body;
  const user = await User.findById(req.user._id);

  if (user) {
    user.is2FAEnabled = enable;
    await user.save();
    res.status(200).json({ message: `2FA ${enable ? 'enabled' : 'disabled'} successfully`, is2FAEnabled: enable });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
}));

module.exports = router;