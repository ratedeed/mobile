const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const generateToken = require('../utils/authUtils'); // Import the centralized token generation utility
const { validationResult } = require('express-validator'); // For input validation

// @desc    Register user
// @route   POST /api/users/register
// @access  Public
exports.registerUser = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, firebaseUid, firstName, lastName } = req.body;

  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(409).json({ message: 'User already exists with this email.' }); // Use 409 Conflict
    }

    // Create user
    user = await User.create({
      email,
      password, // Password will be hashed by pre-save hook in User model
      firebaseUid: firebaseUid || null, // Store Firebase UID if provided
      firstName,
      lastName,
      isVerified: false // Default to false
    });

    // If registered via Firebase, we skip backend email verification 
    // because Firebase handles its own email verification.
    if (firebaseUid) {
      return res.status(201).json({
        message: 'User registered successfully. Please check your email for a verification link from Firebase.',
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified
        }
      });
    }

    // Generate verification token and set expiry
    const verificationToken = user.getVerificationToken(); // Method defined in User model
    await user.save(); // Save user with token and expiry

    // Construct verification URL
    // Use a fixed URL for production, or dynamically for development
    const verificationUrl = `${process.env.BACKEND_API_URL || 'https://api.ratedeed.com'}/api/users/verifyemail/${verificationToken}`;

    const message = `
      <h1>Email Verification</h1>
      <p>Please verify your email by clicking on the link below:</p>
      <a href="${verificationUrl}" clicktracking="off">${verificationUrl}</a>
      <p>This link will expire in 1 hour.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Email Address',
        message
      });

      res.status(201).json({
        message: 'User registered successfully. Please check your email for a verification link.',
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified
        }
      });
    } catch (err) {
      console.error('Error sending verification email:', err);
      // If email fails, you might want to delete the user or mark for manual review
      // await user.remove(); // Or handle differently
      res.status(500).json({ message: 'Email could not be sent. Please try again later.' });
    }

  } catch (error) {
    console.error('Error during user registration:', error);
    res.status(500).json({ message: 'Server error during registration.', details: error.message });
  }
};

// @desc    Verify user email
// @route   GET /api/users/verifyemail/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() } // Token must not be expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    console.log(`verifyEmail: User ${user.email} isVerified status BEFORE update: ${user.isVerified}`);
    user.isVerified = true;
    user.verificationToken = undefined; // Clear token
    user.verificationTokenExpires = undefined; // Clear expiry
    await user.save();
    console.log(`verifyEmail: User ${user.email} isVerified status AFTER update: ${user.isVerified}`);

    // Redirect to a success page or send a success message
    // For a web app, you might redirect to a login page or a success message page.
    // For an API, you'd send JSON.
    res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
    // Or for web: res.redirect('/login.html?verified=true');

  } catch (error) {
    console.error('Error during email verification:', error);
    res.status(500).json({ message: 'Server error during email verification.', details: error.message });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, firebaseUid, firstName, lastName } = req.body;

  try {
    let user;
    if (firebaseUid) {
      console.log(`LoginUser: Attempting login for Firebase UID: ${firebaseUid}`);
      user = await User.findOne({ firebaseUid }); // No need to select password for Firebase users

      if (!user) {
        // If user not found by firebaseUid, create a new user
        console.log(`LoginUser: No user found for Firebase UID: ${firebaseUid}. Creating new user.`);
        // Ensure email is provided for new Firebase user creation
        if (!email) {
          return res.status(400).json({ message: 'Email is required for new Firebase user creation.' });
        }
        user = await User.create({
          email,
          firebaseUid,
          firstName: firstName === '' ? undefined : firstName || null, // Set to undefined if empty string, otherwise use value or null
          lastName: lastName === '' ? undefined : lastName || null,   // Set to undefined if empty string, otherwise use value or null
          isVerified: true, // Assume Firebase users are verified by Firebase itself
        });
        console.log(`LoginUser: New Firebase user created: ID=${user._id}, Email=${user.email}`);
      }
    } else if (email) {
      console.log(`LoginUser: Attempting login for email: ${email}`);
      user = await User.findOne({ email }).select('+password');
      if (!user) {
        console.log(`LoginUser: User not found for email: ${email}`);
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
      // Check if password matches for traditional login
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
    } else {
      return res.status(400).json({ message: 'Missing login identifier (email or firebaseUid).' });
    }

    if (!user) { // This case should ideally not be reached if logic above is correct
      console.log(`LoginUser: User object is null after processing. This should not happen.`);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    console.log(`LoginUser: User found/created: ID=${user._id}, Email=${user.email}`);

    // For Firebase users, email verification is handled by Firebase.
    // For traditional users, check if email is verified.
    if (!user.isVerified && !firebaseUid) { // Only check for traditional logins
      return res.status(403).json({ message: 'Email not verified. Please check your inbox for a verification link.' });
    }

    console.log(`loginUser: User ${user.email} isVerified status BEFORE sending response: ${user.isVerified}`);
    // If verified, generate token and send response
    res.status(200).json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified,
        firebaseUid: user.firebaseUid,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      }
    });

  } catch (error) {
    console.error('Error during user login:', error);
    // If the error is a Mongoose validation error, it will have a 'name' property of 'ValidationError'
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'User validation failed during login/creation.', details: error.message, errors: error.errors });
    }
    res.status(500).json({ message: 'Server error during login.', details: error.message });
  }
};

// @desc    Update backend email verification status (for Firebase sync)
// @route   POST /api/users/verify-email
// @access  Private
exports.updateEmailVerificationStatus = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Firebase ID token is required.' });
  }

  try {
    // Verify the Firebase ID token server-side to prevent client spoofing
    const admin = require('firebase-admin');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const isVerified = decodedToken.email_verified === true;

    if (!isVerified) {
      return res.status(400).json({ message: 'Email is not verified with Firebase.' });
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found in backend database.' });
    }

    if (!user.isVerified) {
      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();
      return res.status(200).json({ message: 'Email verification status updated successfully.' });
    }

    return res.status(200).json({ message: 'Email already verified in backend.' });
  } catch (error) {
    console.error('Backend: Error updating email verification status:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ message: 'Invalid or expired Firebase token.' });
    }
    res.status(500).json({ message: 'Server error updating verification status.', details: error.message });
  }
};

// @desc    Save/Update user's push token for notifications
// @route   PUT /api/users/push-token
// @access  Private
exports.savePushToken = async (req, res) => {
  const { pushToken } = req.body;

  if (!pushToken) {
    return res.status(400).json({ message: 'Push token is required.' });
  }

  try {
    // 1. Remove this token from any other User or Contractor to prevent duplicate notifications
    await User.updateMany({ pushToken }, { $set: { pushToken: null } });
    const Contractor = require('../models/Contractor');
    await Contractor.updateMany({ pushToken }, { $set: { pushToken: null } });

    // 2. Update the current User
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.pushToken = pushToken;
    await user.save();

    // 3. Update associated Contractor profile if exists
    const contractor = await Contractor.findOne({ user: req.user._id });
    if (contractor) {
      contractor.pushToken = pushToken;
      await contractor.save();
    }

    console.log(`savePushToken: Updated push token for user: ${user.email}`);
    res.status(200).json({ message: 'Push token saved successfully.' });
  } catch (error) {
    console.error('savePushToken: Error saving push token:', error);
    res.status(500).json({ message: 'Server error saving push token.', details: error.message });
  }
};