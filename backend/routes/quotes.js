const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Quote = require('../models/Quote');
const Job = require('../models/Job');
const Contractor = require('../models/Contractor');
const { protect } = require('../middleware/authMiddleware');
const { emitLeadNotification } = require('../socketHelpers');

// @desc    Create a new quote
// @route   POST /api/quotes
// @access  Private (Contractor only)
router.post('/', protect, asyncHandler(async (req, res) => {
  try {
    const { clientId, clientName, lineItems, estimatedCompletion, notes } = req.body;

    if (!lineItems || lineItems.length === 0) {
      return res.status(400).json({ message: 'At least one line item is required' });
    }

    // Find contractor profile for the current user
    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }

    const quote = new Quote({
      contractor: contractor._id,
      contractorUser: req.user._id,
      client: clientId,
      clientName,
      lineItems,
      estimatedCompletion,
      notes,
    });

    await quote.save();

    // Create notification for client
    const notification = require('../models/Notification');
    const { sendPushNotification } = require('../utils/pushNotifications');
    await notification.create({
      user: clientId,
      message: `You received a new quote from ${contractor.businessName}`,
      type: 'new_quote',
      link: `/quotes/${quote._id}`,
    });

    // Emit socket notification if user is online
    const io = req.app.get('socketio');
    const activeUsers = req.app.get('activeUsers');
    const clientUser = await require('../models/User').findById(clientId);
    if (clientUser && activeUsers.has(clientUser._id.toString())) {
      io.to(clientUser._id.toString()).emit('newQuote', quote);
    }

    // SEND REAL PUSH NOTIFICATION
    if (clientUser && clientUser.pushToken) {
      console.log(`Backend: Sending push quote notification to user: ${clientUser._id}`);
      await sendPushNotification(clientUser.pushToken, {
        title: 'New Quote Received!',
        body: `You received a new quote from ${contractor.businessName}`,
        data: {
          type: 'new_quote',
          quoteId: quote._id.toString()
        }
      });
    }

    res.status(201).json(quote);
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ message: 'Server error creating quote' });
  }
}));

// @desc    Get all quotes for a contractor
// @route   GET /api/quotes/contractor
// @access  Private (Contractor only)
router.get('/contractor', protect, asyncHandler(async (req, res) => {
  try {
    const contractor = await Contractor.findOne({ user: req.user._id });
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor profile not found' });
    }

    const quotes = await Quote.find({ contractor: contractor._id })
      .populate('client', 'firstName lastName email profilePicture')
      .sort({ createdAt: -1 });

    res.json(quotes);
  } catch (error) {
    console.error('Get contractor quotes error:', error);
    res.status(500).json({ message: 'Server error fetching quotes' });
  }
}));

// @desc    Get quotes for a client (user)
// @route   GET /api/quotes/client
// @access  Private (User only)
router.get('/client', protect, asyncHandler(async (req, res) => {
  try {
    const quotes = await Quote.find({ client: req.user._id })
      .populate('contractor', 'businessName businessName profilePicture')
      .sort({ createdAt: -1 });

    res.json(quotes);
  } catch (error) {
    console.error('Get client quotes error:', error);
    res.status(500).json({ message: 'Server error fetching quotes' });
  }
}));

// @desc    Get a specific quote
// @route   GET /api/quotes/:id
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('contractor', 'businessName profilePicture')
      .populate('client', 'firstName lastName email profilePicture');

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    // Check authorization
    const contractor = await Contractor.findOne({ user: req.user._id });
    const isContractor = contractor && quote.contractor._id.toString() === contractor._id.toString();
    const isClient = quote.client._id.toString() === req.user._id.toString();

    if (!isContractor && !isClient) {
      return res.status(403).json({ message: 'Not authorized to view this quote' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ message: 'Server error fetching quote' });
  }
}));

// @desc    Accept a quote (creates a Job)
// @route   PUT /api/quotes/:id/accept
// @access  Private (Client only)
router.put('/:id/accept', protect, asyncHandler(async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('contractor');

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the client can accept this quote' });
    }

    if (quote.status !== 'pending_user_approval') {
      return res.status(400).json({ message: 'Quote is not pending approval' });
    }

    quote.status = 'accepted';
    await quote.save();

    // Create a Job from the accepted quote
    const job = new Job({
      quote: quote._id,
      contractor: quote.contractor,
      contractorUser: quote.contractorUser,
      client: quote.client,
      clientName: quote.clientName,
      lineItems: quote.lineItems,
      subtotal: quote.subtotal,
      platformFee: quote.platformFee,
      total: quote.total,
      isMilestone: quote.isMilestone,
      milestones: quote.milestones ? quote.milestones.map(m => ({ ...m, status: "pending" })) : [],
      status: 'awaiting_payment',
    });

    await job.save();

    // Notify contractor
    const notification = require('../models/Notification');
    const { sendPushNotification } = require('../utils/pushNotifications');
    await notification.create({
      user: quote.contractorUser,
      message: `${quote.clientName} accepted your quote!`,
      type: 'quote_accepted',
      link: `/jobs/${job._id}`,
    });

    // Emit socket notification
    const io = req.app.get('socketio');
    const activeUsers = req.app.get('activeUsers');
    if (activeUsers.has(quote.contractorUser.toString())) {
      io.to(quote.contractorUser.toString()).emit('quoteAccepted', { quote, job });
    }

    // SEND REAL PUSH NOTIFICATION
    try {
      const contractorUser = await require('../models/User').findById(quote.contractorUser);
      if (contractorUser && contractorUser.pushToken) {
        await sendPushNotification(contractorUser.pushToken, {
          title: 'Quote Accepted!',
          body: `${quote.clientName} accepted your quote. Let's get to work!`,
          data: {
            type: 'quote_accepted',
            jobId: job._id.toString()
          }
        });
      }
    } catch (pushErr) {}

    res.json({ quote, job });
  } catch (error) {
    console.error('Accept quote error:', error);
    res.status(500).json({ message: 'Server error accepting quote' });
  }
}));

// @desc    Reject a quote
// @route   PUT /api/quotes/:id/reject
// @access  Private (Client only)
router.put('/:id/reject', protect, asyncHandler(async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the client can reject this quote' });
    }

    if (quote.status !== 'pending_user_approval') {
      return res.status(400).json({ message: 'Quote is not pending approval' });
    }

    quote.status = 'rejected';
    await quote.save();

    // Notify contractor
    const notification = require('../models/Notification');
    await notification.create({
      user: quote.contractorUser,
      message: `${quote.clientName} rejected your quote`,
      type: 'quote_rejected',
      link: `/quotes/${quote._id}`,
    });

    res.json(quote);
  } catch (error) {
    console.error('Reject quote error:', error);
    res.status(500).json({ message: 'Server error rejecting quote' });
  }
}));

// @desc    Update quote status
// @route   PUT /api/quotes/:id/status
// @access  Private (Contractor only)
router.put('/:id/status', protect, asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;

    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.contractorUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the contractor can update quote status' });
    }

    if (!['pending_user_approval', 'accepted', 'rejected', 'expired'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    quote.status = status;
    await quote.save();

    res.json(quote);
  } catch (error) {
    console.error('Update quote status error:', error);
    res.status(500).json({ message: 'Server error updating quote status' });
  }
}));

// @desc    Delete a quote
// @route   DELETE /api/quotes/:id
// @access  Private (Contractor only)
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return res.status(404).json({ message: 'Quote not found' });
    }

    if (quote.contractorUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the contractor can delete this quote' });
    }

    if (quote.status !== 'pending_user_approval') {
      return res.status(400).json({ message: 'Can only delete pending quotes' });
    }

    await quote.remove();

    res.json({ message: 'Quote deleted' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ message: 'Server error deleting quote' });
  }
}));

module.exports = router;
