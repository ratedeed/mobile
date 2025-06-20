const express = require('express');
const router = express.Router();
const { check } = require('express-validator'); // Import check for validation
const {
  registerUser,
  verifyEmail,
  loginUser,
  updateEmailVerificationStatus
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

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
// @access  Private (or protected by a shared secret/Firebase Admin SDK token)
router.post('/verify-email', protect, updateEmailVerificationStatus);

module.exports = router;