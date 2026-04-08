const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: true,
  },
  contractor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contractor',
    required: true,
  },
  contractorUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  clientName: {
    type: String,
    required: true,
  },
  lineItems: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
  }],
  subtotal: {
    type: Number,
    required: true,
  },
  platformFee: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  fundedAmount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['funded_in_progress', 'completed_paid', 'awaiting_payment', 'cancelled', 'disputed'],
    default: 'awaiting_payment',
  },
  stripePaymentIntentId: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  completionDate: {
    type: Date,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
