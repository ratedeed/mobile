const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const Contractor = require('../models/Contractor');
const Lead = require('../models/Lead');
const Job = require('../models/Job');
const Quote = require('../models/Quote');
const { protect } = require('../middleware/authMiddleware');
const { geocodeZip } = require('../utils/geocodeZip');

// @desc    Get all contractors or search
// @route   GET /api/contractors
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { zipCode, zip, type, name, isFeatured } = req.query;
  const searchZip = zipCode || zip;
  let query = {};
  let sort = {};
  let limit = 0;

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
    let contractors = [];
    let isExpanded = false;
    let expansionTier = 1;

    if (searchZip) {
      // Priority 1: exact zip match OR contractors who serve that zip
      const exactQuery = { ...query, $or: [
        { zipCode: searchZip },
        { zipCodesCovered: searchZip },
      ]};
      contractors = await Contractor.find(exactQuery).sort(sort).limit(limit || 0);

      // Priority 2: if not enough, expand to zip prefix (first 3 digits = same local area)
      if (contractors.length < 30) {
        const prefix = searchZip.slice(0, 3);
        const seenIds = new Set(contractors.map(c => c._id.toString()));
        const prefixQuery = { 
          ...query, 
          $or: [
            { zipCode: { $regex: `^${prefix}` } },
            { zipCodesCovered: { $regex: `^${prefix}` } }
          ]
        };
        // Only fetch enough to reach 30
        const prefixResults = await Contractor.find(prefixQuery).sort(sort).limit(30 - contractors.length);
        let added = 0;
        for (const c of prefixResults) {
          if (!seenIds.has(c._id.toString())) {
            contractors.push(c);
            seenIds.add(c._id.toString());
            added++;
          }
        }
        if (added > 0) {
          isExpanded = true;
          expansionTier = 2;
        }
      }

      // Priority 3: if still not enough, expand to zip prefix (first 2 digits = wider region)
      if (contractors.length < 30) {
        const widePrefix = searchZip.slice(0, 2);
        const seenIds = new Set(contractors.map(c => c._id.toString()));
        const wideQuery = { 
          ...query, 
          $or: [
            { zipCode: { $regex: `^${widePrefix}` } },
            { zipCodesCovered: { $regex: `^${widePrefix}` } }
          ]
        };
        // Only fetch enough to reach 30
        const wideResults = await Contractor.find(wideQuery).sort(sort).limit(30 - contractors.length);
        let added = 0;
        for (const c of wideResults) {
          if (!seenIds.has(c._id.toString())) {
            contractors.push(c);
            seenIds.add(c._id.toString());
            added++;
          }
        }
        if (added > 0) {
          isExpanded = true;
          expansionTier = 3;
        }
      }
    } else {
      // No zip: return all matching contractors
      contractors = await Contractor.find(query).sort(sort).limit(limit || 0);
    }

    // Return object with metadata if zip was used
    if (searchZip) {
      res.json({
        contractors,
        total: contractors.length,
        isExpanded,
        expansionTier,
        page: 1,
        pages: 1,
        limit: limit || contractors.length
      });
    } else {
      res.json(contractors.length > 0 ? contractors : []);
    }
  } catch (error) {
    console.error('Contractor search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}));

// @desc    Get authenticated contractor profile
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

// @desc    Generate SVG banner
// @route   GET /api/contractors/generate-banner
// @access  Public
router.get('/generate-banner', asyncHandler(async (req, res) => {
  const { text, category } = req.query;
  const safeText = text || 'Company Name';
  const safeCategory = category || 'Services';

  const escapedText = safeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const escapedCategory = safeCategory.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Simple deterministic color generation
  const hash = Array.from(escapedText).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash + 40) % 360;

  const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Banner for ${escapedText}">
    <defs>
      <linearGradient id="grad_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue1}, 70%, 50%);stop-opacity:1" />
        <stop offset="100%" style="stop-color:hsl(${hue2}, 70%, 40%);stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad_${hash})" />
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="44" font-weight="bold" fill="#ffffff">${escapedText}</text>
    <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="22" font-weight="normal" fill="#e2e8f0">${escapedCategory}</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
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

// @desc    Get contractor by ID
// @route   GET /api/contractors/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Guard against non-ID strings that might have leaked past earlier routes
  if (['profile', 'generate-banner', 'leads', 'earnings', 'slug'].includes(id)) {
    return res.status(404).json({ message: 'Route not found' });
  }

  // Validate MongoDB ID format
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  try {
    const contractor = await Contractor.findById(id).populate('reviewsList.user', 'firstName lastName profilePicture');
    if (contractor) {
      const { password, posts, reviewsList, ...details } = contractor._doc;
      res.json({ ...details, posts, reviewsList });
    } else {
      res.status(404).json({ message: 'Contractor not found' });
    }
  } catch (error) {
    console.error(`Error fetching contractor by ID ${id}:`, error);
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

  // Create notification for contractor
  const Notification = require('../models/Notification');
  const { sendPushNotification } = require('../utils/pushNotifications');
  const User = require('../models/User');
  
  const notification = await Notification.create({
    recipient: contractor.user,
    recipientModel: 'User',
    sender: req.user._id,
    senderModel: 'User',
    message: `You received a new ${rating}-star review: "${title}"`,
    type: 'new_review',
    link: `/contractors/profile`
  });

  // Emit socket
  const io = req.app.get('socketio');
  if (io) {
    io.to(contractor.user.toString()).emit('newNotification', notification);
  }

  // SEND REAL PUSH NOTIFICATION
  try {
    const contractorUser = await User.findById(contractor.user);
    if (contractorUser && contractorUser.pushToken) {
      await sendPushNotification(contractorUser.pushToken, {
        title: 'New Review Received!',
        body: `A user left you a ${rating}-star review: "${title}"`,
        data: {
          type: 'new_review',
          contractorId: contractor._id.toString()
        }
      });
    }
  } catch (pushErr) {}

  res.status(201).json({ message: 'Review submitted' });
}));

// @desc    Update contractor profile
// @route   PUT /api/contractors/profile
// @access  Private
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const updates = req.body;
  const contractor = await Contractor.findOne({ user: req.user._id });

  if (contractor) {
    try {
      if (updates.contact) {
        // Safe merge of contact info
        const existingContact = contractor.contact ? (typeof contractor.contact.toObject === 'function' ? contractor.contact.toObject() : contractor.contact) : {};
        contractor.contact = { ...existingContact, ...updates.contact };
        
        // Sync root level fields if they exist in contact update
        if (updates.contact.phone) contractor.phone = updates.contact.phone;
        if (updates.contact.email) contractor.email = updates.contact.email;
        
        delete updates.contact;
      }

      // Geocode on write for zipCodesCovered
      if (updates.zipCodesCovered && Array.isArray(updates.zipCodesCovered)) {
        const currentGeoData = contractor.zipGeoData || [];
        const newGeoData = [];
        
        // Retain existing geoData for zip codes that are still covered
        for (const geo of currentGeoData) {
          if (updates.zipCodesCovered.includes(geo.zip)) {
            newGeoData.push(geo);
          }
        }
        
        // Geocode new zip codes that aren't already in geoData
        for (const zip of updates.zipCodesCovered) {
          if (!newGeoData.find(g => g.zip === zip)) {
            console.log(`Geocoding new zip code: ${zip}`);
            
            // Add a small delay to respect Nominatim's 1 req/sec limit
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            const geo = await geocodeZip(zip);
            if (geo) {
              if (geo.bounds && Array.isArray(geo.bounds) && geo.bounds.length === 2) {
                newGeoData.push(geo);
              }
            }
          }
        }
        contractor.zipGeoData = newGeoData;
      }

      // Handle other updates
      Object.assign(contractor, updates);
      
      await contractor.save();
      
      const updatedContractor = await Contractor.findById(contractor._id).select('-password');
      res.json(updatedContractor);
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(400).json({ 
        message: 'Validation failed', 
        details: error.message,
        errors: error.errors 
      });
    }
  } else {
    res.status(404);
    throw new Error('Contractor profile not found');
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

// @desc    Add portfolio item
// @route   POST /api/contractors/portfolio
// @access  Private
router.post('/portfolio', protect, asyncHandler(async (req, res) => {
  const { name, description, imageUrl, images } = req.body;
  const contractor = await Contractor.findOne({ user: req.user._id });

  if (!contractor) {
    return res.status(404).json({ message: 'Contractor not found' });
  }

  contractor.portfolio = contractor.portfolio || [];
  contractor.portfolio.push({
    name,
    description,
    imageUrl,
    images: images || [imageUrl].filter(Boolean)
  });

  await contractor.save();
  res.status(201).json(contractor.portfolio[contractor.portfolio.length - 1]);
}));

// @desc    Delete portfolio item
// @route   DELETE /api/contractors/portfolio/:itemId
// @access  Private
router.delete('/portfolio/:itemId', protect, asyncHandler(async (req, res) => {
  const contractor = await Contractor.findOne({ user: req.user._id });

  if (!contractor) {
    return res.status(404).json({ message: 'Contractor not found' });
  }

  contractor.portfolio = contractor.portfolio.filter(item => item._id.toString() !== req.params.itemId);
  await contractor.save();
  res.json({ message: 'Portfolio item deleted' });
}));

module.exports = router;
