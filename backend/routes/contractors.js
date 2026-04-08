const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const Contractor = require('../models/Contractor');
const Lead = require('../models/Lead');
const Job = require('../models/Job');
const Quote = require('../models/Quote');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all contractors or search
// @route   GET /api/contractors
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { zipCode, type, name, isFeatured } = req.query;
  let query = {};
  let sort = {};
  let limit = 0;

  if (zipCode) query.zipCode = zipCode;
  if (type) query.category = type;
  if (name) {
    query.businessName = { $regex: name.toLowerCase(), $options: 'i' };
  }

  if (isFeatured === 'true') {
    sort.rating = -1;
    limit = 3;
    query.isPremium = true;
  }

  try {
    let contractorsQuery = Contractor.find(query);
    if (Object.keys(sort).length > 0) contractorsQuery = contractorsQuery.sort(sort);
    if (limit > 0) contractorsQuery = contractorsQuery.limit(limit);
    const contractors = await contractorsQuery;
    res.json(contractors.length > 0 ? contractors : []);
  } catch (error) {
    console.error('Contractor search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Get contractor profile
// @route   GET /api/contractors/profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findOne({ user: req.user._id }).populate('reviewsList.user', 'firstName lastName profilePicture');
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }
    const { password, ...profile } = contractor._doc;
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Get contractor by ID
// @route   GET /api/contractors/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  if (req.params.id === 'profile') {
    return res.status(404).json({ message: 'Contractor not found' });
  }
  try {
    const contractor = await Contractor.findById(req.params.id).populate('reviewsList.user', 'firstName lastName profilePicture');
    if (contractor) {
      const { password, posts, reviewsList, ...details } = contractor._doc;
      res.json({ ...details, posts, reviewsList });
    } else {
      res.status(404).json({ message: 'Contractor not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Get contractor by slug
// @route   GET /api/contractors/slug/:slug
// @access  Public
router.get('/slug/:slug', asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findOne({ slug: req.params.slug }).populate('reviewsList.user', 'firstName lastName profilePicture');
    if (contractor) {
      const { password, posts, reviewsList, ...details } = contractor._doc;
      res.json({ ...details, posts, reviewsList });
    } else {
      res.status(404).json({ message: 'Contractor not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Get reviews for contractor
// @route   GET /api/contractors/:id/reviews
// @access  Public
router.get('/:id/reviews', asyncHandler(async (req, res) => {
  const { page = 1, limit = 5 } = req.query;
  try {
    const contractor = await Contractor.findById(req.params.id).populate('reviewsList.user', 'firstName lastName profilePicture');
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    let reviews = (contractor.reviewsList || []).map(review => {
      const user = review.user || {};
      return {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        createdAt: review.createdAt,
        user: {
          _id: user._id || null,
          firstName: user.firstName || 'Unknown',
          lastName: user.lastName || 'User',
          profilePicture: user.profilePicture || 'https://via.placeholder.com/150',
        },
      };
    });

    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedReviews = reviews.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      reviews: paginatedReviews,
      page: parseInt(page),
      pages: Math.ceil(reviews.length / parseInt(limit)),
      total: reviews.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Submit review
// @route   POST /api/contractors/:id/reviews
// @access  Private
router.post('/:id/reviews', protect, asyncHandler(async (req, res) => {
  const { rating, title, comment } = req.body;
  const contractor = await Contractor.findById(req.params.id);

  if (!contractor) {
    return res.status(404).json({ message: 'Contractor not found' });
  }

  contractor.reviewsList = contractor.reviewsList || [];
  contractor.reviewsList.push({ user: req.user._id, rating, title, comment, createdAt: new Date() });
  contractor.reviews = contractor.reviewsList.length;
  contractor.rating = contractor.reviewsList.reduce((sum, r) => sum + r.rating, 0) / contractor.reviews;
  await contractor.save();

  res.status(201).json({ message: 'Review submitted' });
}));

// @desc    Update contractor profile
// @route   PUT /api/contractors/profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const updates = req.body;
  const contractor = await Contractor.findOne({ user: req.user._id });

  if (contractor) {
    if (updates.contact) {
      contractor.contact = { ...contractor.contact, ...updates.contact };
      delete updates.contact;
    }
    Object.assign(contractor, updates);
    await contractor.save();
    const { password, ...profile } = contractor._doc;
    res.json(profile);
  } else {
    res.status(404);
    throw new Error('Contractor profile not found');
  }
}));

// @desc    Follow contractor
// @route   POST /api/contractors/:id/follow
// @access  Private
router.post('/:id/follow', protect, asyncHandler(async (req, res) => {
  res.json({ message: 'Follow functionality coming soon' });
}));

// @desc    Get leads for contractor
// @route   GET /api/contractors/leads
// @access  Private
router.get('/leads', protect, asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }
    const leads = await Lead.find({ contractor: contractor._id }).sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Get earnings for contractor
// @route   GET /api/contractors/earnings
// @access  Private
router.get('/earnings', protect, asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }

    const jobs = await Job.find({ contractor: contractor._id });
    const quotes = await Quote.find({ contractor: contractor._id });

    const totalEarnings = jobs.filter(j => j.status === 'completed_paid').reduce((sum, j) => sum + j.total, 0);
    const pendingEscrow = jobs.filter(j => j.status === 'funded_in_progress').reduce((sum, j) => sum + j.total, 0);

    const monthlyEarnings = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyEarnings.push({ month: monthName, amount: 0 });
    }

    res.json({
      totalEarnings,
      pendingEscrow,
      monthlyEarnings,
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === 'completed_paid').length,
      pendingJobs: jobs.filter(j => j.status === 'funded_in_progress').length,
      totalQuotes: quotes.length,
      acceptedQuotes: quotes.filter(q => q.status === 'accepted').length,
      pendingQuotes: quotes.filter(q => q.status === 'pending_user_approval').length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Get portfolio
// @route   GET /api/contractors/:id/portfolio
// @access  Public
router.get('/:id/portfolio', asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findById(req.params.id);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }
    res.json(contractor.portfolio || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}));

module.exports = router;
