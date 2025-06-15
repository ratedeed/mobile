const mongoose = require('mongoose');

const contractorSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    trim: true,
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  rating: {
    type: Number,
    default: 0,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  imageUrl: {
    type: String,
    default: 'https://via.placeholder.com/150',
  },
  bannerUrl: {
    type: String,
    default: 'https://via.placeholder.com/600x200',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  bio: {
    type: String,
    default: 'No bio provided yet.',
  },
  yearsInBusiness: {
    type: Number,
  },
  certifications: [String],
  pricing: {
    type: String,
  },
  areasServed: [String],
  services: [String],
  portfolio: [String], // URLs to images/projects
  posts: [
    {
      title: String,
      content: String,
      imageUrl: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  contact: {
    phone: String,
    email: String,
    website: String,
    address: String,
  },
  reviewsList: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      rating: Number,
      title: String,
      comment: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, {
  timestamps: true,
});

const Contractor = mongoose.model('Contractor', contractorSchema);

module.exports = Contractor;