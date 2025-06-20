const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing
const crypto = require('crypto'); // For generating tokens

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password in queries by default
  },
  // Add these fields for email verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  // If you're using Firebase as primary auth, you might store Firebase UID
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true // Allows null values, useful if not all users come from Firebase
  },
  firstName: {
    type: String,
    required: false, // Not required for login, only for registration if provided
  },
  lastName: {
    type: String,
    required: false, // Not required for login, only for registration if provided
  },
  role: {
    type: String,
    enum: ['user', 'contractor', 'admin'],
    default: 'user',
  },
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Encrypt password using bcrypt
// Encrypt password using bcrypt before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next(); // Only hash if the password has been modified
  }
  const salt = await bcrypt.genSalt(10); // Generate salt with 10 rounds
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password reset token (example, similar for verification)
userSchema.methods.getVerificationToken = function() {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to verificationToken field
  // For email verification, we usually send the plain token in the URL,
  // but store a hashed version or just the plain token if it's one-time use.
  // For simplicity, we'll store the plain token here as it's short-lived.
  this.verificationToken = verificationToken;

  // Set expire
  this.verificationTokenExpires = Date.now() + 3600000; // 1 hour

  return verificationToken;
};

module.exports = mongoose.model('User', userSchema);