const express = require('express');
const asyncHandler = require('express-async-handler'); // Import asyncHandler
const router = express.Router();
const Contractor = require('../models/Contractor');
const { protect } = require('../middleware/authMiddleware'); // Import protect middleware

// @desc    Get all contractors or search by zip code and/or category and/or name, and featured
// @route   GET /api/contractors?zip=:zipCode&type=:category&name=:name&isFeatured=true
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { zip, type, name, isFeatured } = req.query;
  console.log('Backend: Received query parameters:', { zip, type, name, isFeatured });
  let query = {};
  let sort = {};
  let limit = 0;

  if (zip) {
    query.zipCode = zip;
  }
  if (type) {
    query.category = type;
  }
  if (name) {
    const lowerCaseName = name.toLowerCase();
    query.businessName = { $regex: lowerCaseName, $options: 'i' };
  }

  if (isFeatured === 'true') {
    sort.rating = -1; // Sort by rating descending
    limit = 3; // Limit to 3 featured contractors
    // Optionally, add criteria for featured, e.g., isPremium
    query.isPremium = true;
  }

  console.log('Backend: Constructed MongoDB query:', query);
  try {
    let contractorsQuery = Contractor.find(query);

    if (Object.keys(sort).length > 0) {
      contractorsQuery = contractorsQuery.sort(sort);
    }

    if (limit > 0) {
      contractorsQuery = contractorsQuery.limit(limit);
    }

    const contractors = await contractorsQuery;

    if (contractors.length > 0) {
      res.json(contractors);
    } else {
      // If no specific search parameters were provided, return an empty array (no 404)
      if (!zip && !type && !name && isFeatured !== 'true') {
        res.json([]);
      } else {
        // If search parameters were provided but no contractors matched, return 404
        res.status(404).json({ message: 'No contractors found for the given criteria' });
      }
    }
  } catch (error) {
    console.error('Contractor search/fetch API error:', error);
    res.status(500).json({ message: 'Server error during contractor search/fetch', error: error.message });
  }
}));

// @desc    Get contractor by ID
// @route   GET /api/contractors/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const contractor = await Contractor.findById(id).populate('reviewsList.user', 'firstName lastName profilePicture');
    if (contractor) {
      console.log('Contractor details fetched, reviewsList:', contractor.reviewsList);
      // Destructure to exclude password, but include posts and populated reviewsList
      const { password, posts, reviewsList, ...contractorDetails } = contractor._doc;
      res.status(200).json({ ...contractorDetails, posts, reviewsList });
    } else {
      res.status(404).json({ message: 'Contractor not found' });
    }
  } catch (error) {
    console.error('Contractor API error:', error);
    res.status(500).json({ message: 'Server error fetching contractor' });
  }
}));

// @desc    Submit contractor review
// @route   POST /api/contractors/:id/reviews
// @access  Private (User only) - assuming reviews are submitted by authenticated users
router.post('/:id/reviews', protect, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, title, comment } = req.body; // userId will come from req.user._id

  const contractor = await Contractor.findById(id);

  if (!contractor) {
    res.status(404);
    throw new Error('Contractor not found');
  }

  // Check if the user is trying to review their own profile (if applicable)
  // This check assumes a 'user' field in Contractor model linking to User model
  // if (contractor.user.toString() === req.user._id.toString()) {
  //   res.status(400);
  //   throw new Error('You cannot review your own contractor profile.');
  // }

  // Check if the user has already reviewed this contractor (if using a separate Review model)
  // const alreadyReviewed = await Review.findOne({ contractor: id, user: req.user._id });
  // if (alreadyReviewed) {
  //   res.status(400);
  //   throw new Error('You have already submitted a review for this contractor.');
  // }

  const newReview = { user: req.user._id, rating, title, comment, createdAt: new Date() };
  contractor.reviewsList.push(newReview);
  const totalRating = contractor.reviewsList.reduce((sum, r) => sum + r.rating, 0);
  contractor.reviews = contractor.reviewsList.length;
  contractor.rating = totalRating / contractor.reviews;
  await contractor.save();
  res.status(201).json({ message: 'Review submitted successfully', review: newReview });
}));

// @desc    Update contractor profile
// @route   PUT /api/contractors/profile
// @access  Private (Contractor only)
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const updatedFields = req.body;
  // Find contractor by the user ID from the authenticated token
  const contractor = await Contractor.findOne({ user: req.user._id });
// @desc    Get reviews for a specific contractor by ID (from URL parameter)
// @route   GET /api/contractors/:id/reviews
// @access  Public
router.get('/:id/reviews', asyncHandler(async (req, res) => {
  const contractorId = req.params.id;
  const { page = 1, limit = 5 } = req.query;

  if (!contractorId) {
    return res.status(400).json({ message: 'Contractor ID is required' });
  }

  const contractor = await Contractor.findById(contractorId).populate('reviewsList.user', 'firstName lastName profilePicture');

  if (!contractor) {
    return res.status(404).json({ message: 'Contractor not found' });
  }

  let reviews = (contractor.reviewsList || []).map(review => {
    const user = review.user; // This is the populated user object
    const profilePicture = (user && user.profilePicture) ? user.profilePicture : 'https://via.placeholder.com/150';

    return {
      _id: review._id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt,
      user: { // Explicitly construct the user object
        _id: user ? user._id : null,
        firstName: user ? user.firstName : 'Unknown',
        lastName: user ? user.lastName : 'User',
        profilePicture: profilePicture,
      },
    };
  });

  // Sort reviews by createdAt in descending order (newest first)
  reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Apply pagination
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedReviews = reviews.slice(startIndex, endIndex);
  const totalPages = Math.ceil(reviews.length / parseInt(limit));

  res.status(200).json({
    reviews: paginatedReviews,
    page: parseInt(page),
    pages: totalPages,
    total: reviews.length
  });

}));

  if (contractor) {
    if (updatedFields.contact) {
      contractor.contact = {
        ...contractor.contact,
        ...updatedFields.contact
      };
      delete updatedFields.contact;
    }
    Object.assign(contractor, updatedFields);
    await contractor.save();
    const { password, ...updatedContractorProfile } = contractor._doc;
    res.status(200).json(updatedContractorProfile);
  } else {
    res.status(404);
    throw new Error('Contractor profile not found');
  }
}));

module.exports = router;