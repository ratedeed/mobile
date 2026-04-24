const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    firebaseUid: { // New field for Firebase UID
        type: String,
        unique: true,
        sparse: true, // Allows null values to not violate unique constraint
    },
    password: {
        type: String,
        required: false, // Password is not required if using Firebase Auth
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    role: {
        type: String,
        enum: ['user', 'contractor', 'admin', 'moderator', 'support', 'homeowner'],
        default: 'user',
    },
    profilePicture: {
        type: String,
    },
    bannerImage: {
        type: String,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    address: {
        type: String,
        required: false,
    },
    zipCode: { // New field for zip code
        type: String,
        required: false,
    },
    savedContractors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contractor',
    }],
    pushToken: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    // Only attempt to compare password if it exists (for non-Firebase users)
    if (this.password) {
        return await bcrypt.compare(enteredPassword, this.password);
    }
    return false; // No password to match if using Firebase
};

UserSchema.pre('save', async function (next) {
    // Only hash password if it's modified and exists (for non-Firebase users)
    if (this.isModified('password') && this.password) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});


const User = mongoose.model('User', UserSchema);

module.exports = User;
