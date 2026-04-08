const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Contractor = require('../models/Contractor');
const { protect } = require('../middleware/authMiddleware');

// Get all posts or posts for a specific contractor, with pagination
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { contractor: contractorId, page = 1, limit = 10 } = req.query;

    let posts = [];
    let totalPosts = 0;

    if (contractorId && contractorId.length > 0) {
      const contractor = await Contractor.findById(contractorId).populate('user', 'firstName lastName profilePicture');
      if (!contractor) {
        return res.status(404).json({ message: 'Contractor not found' });
      }
      posts = (contractor.posts || []).map(post => ({
        _id: post._id,
        caption: post.caption,
        images: post.images || [],
        likes: post.likes || [],
        comments: post.comments || [],
        createdAt: post.createdAt,
        contractor: {
          _id: contractor._id,
          user: {
            _id: contractor.user._id,
            firstName: contractor.user.firstName,
            lastName: contractor.user.lastName,
            profilePicture: contractor.user.profilePicture || contractor.imageUrl,
          },
          companyName: contractor.businessName,
        },
      }));
      totalPosts = posts.length;
    } else {
      const contractors = await Contractor.find({}).populate('user', 'firstName lastName profilePicture');
      for (const contractor of contractors) {
        if (contractor.posts && contractor.posts.length > 0) {
          const postsWithContractorInfo = (contractor.posts || []).map(post => ({
            _id: post._id,
            caption: post.caption,
            images: post.images || [],
            likes: post.likes || [],
            comments: post.comments || [],
            createdAt: post.createdAt,
            contractor: {
              _id: contractor._id,
              user: {
                _id: contractor.user._id,
                firstName: contractor.user.firstName,
                lastName: contractor.user.lastName,
                profilePicture: contractor.user.profilePicture || contractor.imageUrl,
              },
              companyName: contractor.businessName,
            },
          }));
          posts = posts.concat(postsWithContractorInfo);
        }
      }
      totalPosts = posts.length;
    }

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
}));

// Get posts for a specific contractor by ID
router.get('/contractor/:id', asyncHandler(async (req, res) => {
  try {
    const contractorId = req.params.id;
    const { page = 1, limit = 10 } = req.query;

    if (!contractorId) {
      return res.status(400).json({ message: 'Contractor ID is required' });
    }

    const contractor = await Contractor.findById(contractorId).populate('user', 'firstName lastName profilePicture');

    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    let posts = (contractor.posts || []).map(post => ({
      _id: post._id,
      caption: post.caption,
      images: post.images || [],
      likes: post.likes || [],
      comments: post.comments || [],
      createdAt: post.createdAt,
      contractor: {
        _id: contractor._id,
        user: {
          _id: contractor.user._id,
          firstName: contractor.user.firstName,
          lastName: contractor.user.lastName,
          profilePicture: contractor.user.profilePicture || contractor.imageUrl,
        },
        companyName: contractor.businessName,
      },
    }));

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
}));

// Create a new post for a contractor
router.post('/', protect, asyncHandler(async (req, res) => {
  try {
    const { caption, images } = req.body;

    const contractor = await Contractor.findOne({ user: req.user._id });

    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found for this user' });
    }

    const newPost = {
      _id: new mongoose.Types.ObjectId(),
      caption,
      images: images || [],
      likes: [],
      comments: [],
      createdAt: new Date(),
    };

    contractor.posts = contractor.posts || [];
    contractor.posts.push(newPost);
    await contractor.save();

    const populatedPost = {
      ...newPost,
      contractor: {
        _id: contractor._id,
        user: {
          _id: contractor.user._id,
          firstName: contractor.user.firstName,
          lastName: contractor.user.lastName,
          profilePicture: contractor.user.profilePicture || contractor.imageUrl,
        },
        companyName: contractor.businessName,
      },
    };

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Create post API error:', error);
    res.status(500).json({ message: 'Server error creating post' });
  }
}));

// Like/unlike a post
router.put('/:postId/like', protect, asyncHandler(async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const contractor = await Contractor.findOne({ 'posts._id': postId });

    if (!contractor) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = contractor.posts.id(postId);
    if (!post.likes) {
      post.likes = [];
    }

    const likeIndex = post.likes.findIndex(id => id.toString() === userId.toString());

    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(userId);
    }

    await contractor.save();

    res.status(200).json({ likes: post.likes, liked: likeIndex === -1 });
  } catch (error) {
    console.error('Like post API error:', error);
    res.status(500).json({ message: 'Server error liking post' });
  }
}));

// Comment on a post
router.post('/:postId/comments', protect, asyncHandler(async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const contractor = await Contractor.findOne({ 'posts._id': postId });

    if (!contractor) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = contractor.posts.id(postId);
    if (!post.comments) {
      post.comments = [];
    }

    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      user: req.user._id,
      text,
      createdAt: new Date(),
    };

    post.comments.push(newComment);
    await contractor.save();

    const populatedComment = {
      _id: newComment._id,
      text: newComment.text,
      createdAt: newComment.createdAt,
      user: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
    };

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('Comment on post API error:', error);
    res.status(500).json({ message: 'Server error commenting on post' });
  }
}));

module.exports = router;
