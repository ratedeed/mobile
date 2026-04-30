const mongoose = require('mongoose');

const quoteLineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

const quoteSchema = new mongoose.Schema({
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
  lineItems: [quoteLineItemSchema],
  subtotal: {
    type: Number,
    required: true,
  },
  platformFee: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending_user_approval', 'accepted', 'rejected', 'expired'],
    default: 'pending_user_approval',
  },
  estimatedCompletion: {
    type: Date,
  },
  isMilestone: {
    type: Boolean,
    default: false,
  },
  milestones: [{
    name: String,
    percentage: Number,
    amount: Number,
  }],
  notes: {
    type: String,
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from creation
    },
  },
}, {
  timestamps: true,
});

// Calculate subtotal and total before saving
quoteSchema.pre('save', function(next) {
  this.subtotal = this.lineItems.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
  this.platformFee = Math.round(this.subtotal * 0.05 * 100) / 100; // 5% platform fee
  this.total = this.subtotal + this.platformFee;

  // Auto-generate milestones for large projects
  if (this.total >= 5000) {
    this.isMilestone = true;
    this.milestones = [
      { name: "Deposit (30%)", percentage: 30, amount: Math.round(this.total * 0.3 * 100) / 100 },
      { name: "Midpoint (30%)", percentage: 30, amount: Math.round(this.total * 0.3 * 100) / 100 },
      { name: "Completion (40%)", percentage: 40, amount: Math.round(this.total * 0.4 * 100) / 100 }
    ];
  } else {
    this.isMilestone = false;
    this.milestones = [];
  }
  next();
});

quoteSchema.index({ client: 1 });
quoteSchema.index({ contractor: 1 });
quoteSchema.index({ contractorUser: 1 });
quoteSchema.index({ status: 1 });

const Quote = mongoose.model('Quote', quoteSchema);

module.exports = Quote;
