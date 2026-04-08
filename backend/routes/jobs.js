const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Job = require('../models/Job');
const Contractor = require('../models/Contractor');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all jobs for a contractor
// @route   GET /api/jobs/contractor
// @access  Private (Contractor only)
router.get('/contractor', protect, asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }

    const jobs = await Job.find({ contractor: contractor._id })
      .populate('client', 'firstName lastName email profilePicture')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    console.error('Get contractor jobs error:', error);
    res.status(500).json({ message: 'Server error fetching jobs' });
  }
}));

// @desc    Get jobs for a client (user)
// @route   GET /api/jobs/client
// @access  Private (User only)
router.get('/client', protect, asyncHandler(async (req, res) => {
  try {
    const jobs = await Job.find({ client: req.user._id })
      .populate('contractor', 'businessName profilePicture')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    console.error('Get client jobs error:', error);
    res.status(500).json({ message: 'Server error fetching jobs' });
  }
}));

// @desc    Get a specific job
// @route   GET /api/jobs/:id
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('contractor', 'businessName profilePicture')
      .populate('client', 'firstName lastName email profilePicture')
      .populate('quote');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check authorization
    const contractor = await Contractor.findOne({ user: req.user._id });
    const isContractor = contractor && job.contractor._id.toString() === contractor._id.toString();
    const isClient = job.client._id.toString() === req.user._id.toString();

    if (!isContractor && !isClient) {
      return res.status(403).json({ message: 'Not authorized to view this job' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server error fetching job' });
  }
}));

// @desc    Update job status
// @route   PUT /api/jobs/:id/status
// @access  Private
router.put('/:id/status', protect, asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const contractor = await Contractor.findOne({ user: req.user._id });
    const isContractor = contractor && job.contractor._id.toString() === contractor._id.toString();
    const isClient = job.client._id.toString() === req.user._id.toString();

    // Valid status transitions
    const validStatuses = ['funded_in_progress', 'completed_paid', 'awaiting_payment', 'cancelled', 'disputed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Only contractor can mark as in_progress or completed
    if (['funded_in_progress', 'completed_paid'].includes(status) && !isContractor) {
      return res.status(403).json({ message: 'Only contractor can update to this status' });
    }

    job.status = status;
    if (status === 'completed_paid') {
      job.completionDate = new Date();
    }
    await job.save();

    // Notify the other party
    const notification = require('../models/Notification');
    const notifyUserId = isContractor ? job.client : job.contractorUser;
    const statusMessage = isContractor 
      ? `Job status updated to ${status.replace('_', ' ')}`
      : `Contractor updated job status to ${status.replace('_', ' ')}`;

    await notification.create({
      user: notifyUserId,
      message: statusMessage,
      type: 'job_update',
      link: `/jobs/${job._id}`,
    });

    res.json(job);
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ message: 'Server error updating job status' });
  }
}));

// @desc    Fund a job (mark as paid - placeholder for Stripe)
// @route   PUT /api/jobs/:id/fund
// @access  Private (Client only)
router.put('/:id/fund', protect, asyncHandler(async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the client can fund this job' });
    }

    if (job.status !== 'awaiting_payment') {
      return res.status(400).json({ message: 'Job is not awaiting payment' });
    }

    // In production, this would integrate with Stripe
    // For now, just mark as funded
    job.status = 'funded_in_progress';
    job.paymentStatus = 'paid';
    job.fundedAmount = job.total;
    await job.save();

    // Notify contractor
    const notification = require('../models/Notification');
    await notification.create({
      user: job.contractorUser,
      message: `${job.clientName} has funded the project! Work can now begin.`,
      type: 'job_funded',
      link: `/jobs/${job._id}`,
    });

    res.json(job);
  } catch (error) {
    console.error('Fund job error:', error);
    res.status(500).json({ message: 'Server error funding job' });
  }
}));

module.exports = router;
