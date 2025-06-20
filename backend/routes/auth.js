const express = require('express');
const asyncHandler = require('express-async-handler');
const { check, validationResult } = require('express-validator'); // Import express-validator
const router = express.Router();
const User = require('../models/User');
const Contractor = require('../models/Contractor');
const generateToken = require('../utils/authUtils'); // Use the centralized token generation utility

// @desc    Forgot password route
// @route   POST /api/auth/forgot-password
// @access  Public
router.post(
  '/forgot-password',
  [
    check('email', 'Please include a valid email').isEmail(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      // In a real application, send a password reset email here
      res.status(200).json({ message: 'Password reset link sent to your email (simulated)' });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  })
);

// @desc    Register a new contractor
// @route   POST /api/auth/contractor-signup
// @access  Public
router.post(
  '/contractor-signup',
  [
    check('businessName', 'Business name is required').not().isEmpty(),
    check('contactPerson', 'Contact person is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('phone', 'Phone number is required').not().isEmpty(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('zipCode', 'Zip code is required').not().isEmpty(),
    check('category', 'Category is required').not().isEmpty(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { businessName, contactPerson, email, phone, password, zipCode, category } = req.body;

    const contractorExists = await Contractor.findOne({ email });

    if (contractorExists) {
      res.status(409); // Use 409 Conflict for existing resource
      throw new Error('Contractor with this email already exists');
    }

    // Create a new User entry for the contractor
    const user = await User.create({
      firstName: contactPerson.split(' ')[0] || 'Contractor', // Assuming first name from contactPerson
      lastName: contactPerson.split(' ')[1] || 'User', // Assuming last name from contactPerson
      email,
      password, // Password will be hashed by pre-save hook in User model
      role: 'contractor', // Set role to 'contractor'
    });

    if (user) {
      const newContractor = await Contractor.create({
        user: user._id, // Link to the newly created user
        businessName,
        contactPerson,
        zipCode,
        category,
        contact: { // Populate the contact sub-document
          email,
          phone,
          // website and address can be added later via profile update
        },
        // Other fields can be set to defaults or left empty
      });

      if (newContractor) {
        res.status(201).json({
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
          contractorProfile: {
            _id: newContractor._id,
            businessName: newContractor.businessName,
            category: newContractor.category,
            zipCode: newContractor.zipCode,
          }
        });
      } else {
        res.status(400);
        throw new Error('Invalid contractor data provided.'); // More specific error message
      }
    } else {
      res.status(400);
      throw new Error('Invalid user data for contractor registration.'); // More specific error message
    }
  })
);

module.exports = router;