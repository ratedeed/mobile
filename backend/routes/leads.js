const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Lead = require('../models/Lead');
const Contractor = require('../models/Contractor');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// @desc    Create a new lead (user inquiries for contractor)
// @route   POST /api/leads
// @access  Public (for users to submit inquiries)
router.post('/', asyncHandler(async (req, res) => {
  try {
    const { contractorId, projectTitle, description, zipCode, contactPreference, budget, timeline, userName, userEmail, userPhone } = req.body;

    if (!contractorId || !projectTitle || !description) {
      return res.status(400).json({ message: 'Contractor ID, project title, and description are required' });
    }

    const contractor = await Contractor.findById(contractorId);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }

    const lead = new Lead({
      contractor: contractor._id,
      contractorUser: contractor.user,
      projectTitle,
      description,
      zipCode,
      contactPreference: contactPreference || 'any',
      budget,
      timeline,
      userName,
      userEmail,
      userPhone,
    });

    // If user is logged in, associate their account
    // This would need auth middleware to be adapted for public route
    await lead.save();

    // Notify contractor
    const notification = require('../models/Notification');
    await notification.create({
      user: contractor.user,
      message: `New lead: ${projectTitle}`,
      type: 'new_lead',
      link: `/leads/${lead._id}`,
    });

    res.status(201).json(lead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ message: 'Server error creating lead' });
  }
}));

// @desc    Get all leads for a contractor
// @route   GET /api/leads/contractor
// @access  Private (Contractor only)
router.get('/contractor', protect, asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }

    const leads = await Lead.find({ contractor: contractor._id })
      .sort({ createdAt: -1 });

    res.json(leads);
  } catch (error) {
    console.error('Get contractor leads error:', error);
    res.status(500).json({ message: 'Server error fetching leads' });
  }
}));

// @desc    Get a specific lead
// @route   GET /api/leads/:id
// @access  Private (Contractor only)
router.get('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor || lead.contractor._id.toString() !== contractor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this lead' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ message: 'Server error fetching lead' });
  }
}));

// @desc    Update lead status
// @route   PUT /api/leads/:id/status
// @access  Private (Contractor only)
router.put('/:id/status', protect, asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor || lead.contractor._id.toString() !== contractor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this lead' });
    }

    const validStatuses = ['new', 'contacted', 'quoted', 'in_progress', 'completed', 'lost'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    lead.status = status;
    await lead.save();

    res.json(lead);
  } catch (error) {
    console.error('Update lead status error:', error);
    res.status(500).json({ message: 'Server error updating lead status' });
  }
}));

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Private (Contractor only)
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor || lead.contractor._id.toString() !== contractor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this lead' });
    }

    await lead.remove();

    res.json({ message: 'Lead deleted' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ message: 'Server error deleting lead' });
  }
}));

module.exports = router;
