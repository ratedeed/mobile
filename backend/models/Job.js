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
  isMilestone: {
    type: Boolean,
    default: false,
  },
  milestones: [{
    name: String,
    amount: Number,
    status: { type: String, enum: ["pending", "funded", "released"], default: "pending" },
    stripePaymentIntentId: String,
    stripeTransferId: String,
  }],
  fundedAmount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["partially_funded", 'funded_in_progress', 'completed_paid', 'awaiting_payment', 'cancelled', 'disputed'],
    default: 'awaiting_payment',
  },
  stripePaymentIntentId: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ["partially_funded", 'pending', 'paid', 'failed', 'refunded'],
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

jobSchema.index({ client: 1 });
jobSchema.index({ contractor: 1 });
jobSchema.index({ contractorUser: 1 });
jobSchema.index({ quote: 1 });
jobSchema.index({ status: 1 });

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
