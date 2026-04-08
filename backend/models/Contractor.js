const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const postSchema = new mongoose.Schema({
  caption: {
    type: String,
    required: true,
  },
  images: [String],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  comments: [commentSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const contractorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
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
  numReviews: {
    type: Number,
    default: 0,
  },
  averageRating: {
    type: Number,
    default: 0,
  },
  imageUrl: {
    type: String,
    default: 'https://via.placeholder.com/150',
  },
  licenseDocumentUrl: {
    type: String,
    default: '',
  },
  bannerUrl: {
    type: String,
    default: 'https://via.placeholder.com/600x200',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isSponsored: {
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
  description: {
    type: String,
    default: '',
  },
  yearsInBusiness: {
    type: Number,
  },
  certifications: [String],
  pricing: {
    type: String,
  },
  areasServed: [String],
  zipCodesCovered: [String],
  servicesOffered: [String],
  services: [String],
  portfolio: [{
    imageUrl: String,
    caption: String,
  }],
  posts: [postSchema],
  contact: {
    phone: String,
    email: String,
    website: String,
    address: String,
  },
  reviewsList: [{
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
  }],
}, {
  timestamps: true,
});

// Virtual for populating user
contractorSchema.virtual('userDetails').get(function() {
  return this._user;
});

// Ensure virtuals are included in JSON
contractorSchema.set('toJSON', { virtuals: true });
contractorSchema.set('toObject', { virtuals: true });

const Contractor = mongoose.model('Contractor', contractorSchema);

module.exports = Contractor;
