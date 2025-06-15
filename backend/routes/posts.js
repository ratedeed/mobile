const express = require('express');
const router = express.Router();
const Contractor = require('../models/Contractor');
const User = require('../models/User'); // Import User to populate contractor.user

// Get all posts or posts for a specific contractor, with pagination
router.get('/', async (req, res) => {
  try {
    const { contractor: contractorId, page = 1, limit = 5 } = req.query; // Extract contractorId, page, limit from query parameters

    let posts = [];
    let totalPosts = 0;

    if (contractorId && contractorId.length > 0) {
      // If contractorId is provided, fetch posts for that specific contractor
      // Populate the 'user' field of the Contractor to get firstName, lastName, etc.
      const contractor = await Contractor.findById(contractorId).populate('user', 'firstName lastName');
      if (!contractor) {
        return res.status(404).json({ message: 'Contractor not found' });
      }
      // Manually add contractor info to each embedded post
      posts = (contractor.posts || []).map(post => ({
        ...post.toObject(),
        contractor: {
          _id: contractor._id,
          user: {
            _id: contractor.user._id,
            firstName: contractor.user.firstName,
            lastName: contractor.user.lastName,
            profilePicture: contractor.imageUrl, // Using contractor's imageUrl as profile picture
          },
          companyName: contractor.businessName,
        },
        // Assuming likes and comments are dynamically added by the backend or not needed for this view
        // If they are needed, the backend needs to be updated to add them
        likes: [], // Placeholder
        comments: [], // Placeholder
      }));
      totalPosts = posts.length;

    } else {
      // If no contractorId, fetch all posts from all contractors (current behavior for general feed)
      const contractors = await Contractor.find({}).populate('user', 'firstName lastName');
      for (const contractor of contractors) {
        if (contractor.posts && contractor.posts.length > 0) {
          const postsWithContractorInfo = (contractor.posts || []).map(post => ({
            ...post.toObject(),
            contractor: {
              _id: contractor._id,
              user: {
                _id: contractor.user._id,
                firstName: contractor.user.firstName,
                lastName: contractor.user.lastName,
                profilePicture: contractor.imageUrl, // Using contractor's imageUrl as profile picture
              },
              companyName: contractor.businessName,
            },
            likes: [], // Placeholder
            comments: [], // Placeholder
          }));
          posts = posts.concat(postsWithContractorInfo);
        }
      }
      totalPosts = posts.length;
    }

    // Sort posts by createdAt in descending order (newest first)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPosts = posts.slice(startIndex, endIndex);
    const totalPages = Math.ceil(totalPosts / parseInt(limit));

    res.status(200).json({
      posts: paginatedPosts,
      page: parseInt(page),
      pages: totalPages,
      total: totalPosts
    });

  } catch (error) {
    console.error('Fetch posts API error:', error);
    res.status(500).json({ message: 'Server error fetching posts' });
  }
});

// Get posts for a specific contractor by ID (from URL parameter)
router.get('/contractor/:id', async (req, res) => {
  try {
    const contractorId = req.params.id;
    const { page = 1, limit = 5 } = req.query;

    if (!contractorId) {
      return res.status(400).json({ message: 'Contractor ID is required' });
    }

    const contractor = await Contractor.findById(contractorId).populate('user', 'firstName lastName');

    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    let posts = (contractor.posts || []).map(post => ({
      ...post.toObject(),
      contractor: {
        _id: contractor._id,
        user: {
          _id: contractor.user._id,
          firstName: contractor.user.firstName,
          lastName: contractor.user.lastName,
          profilePicture: contractor.imageUrl,
        },
        companyName: contractor.businessName,
      },
      likes: [],
      comments: [],
    }));

    // Sort posts by createdAt in descending order (newest first)
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPosts = posts.slice(startIndex, endIndex);
    const totalPages = Math.ceil(posts.length / parseInt(limit));

    res.status(200).json({
      posts: paginatedPosts,
      page: parseInt(page),
      pages: totalPages,
      total: posts.length
    });

  } catch (error) {
    console.error('Fetch contractor posts by ID API error:', error);
    res.status(500).json({ message: 'Server error fetching contractor posts' });
  }
});

module.exports = router;