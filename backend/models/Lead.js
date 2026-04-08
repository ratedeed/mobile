const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
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
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  userName: {
    type: String,
  },
  userEmail: {
    type: String,
  },
  userPhone: {
    type: String,
  },
  projectTitle: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
  },
  contactPreference: {
    type: String,
    enum: ['email', 'phone', 'message', 'any'],
    default: 'any',
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'quoted', 'in_progress', 'completed', 'lost'],
    default: 'new',
  },
  budget: {
    type: String,
  },
  timeline: {
    type: String,
  },
}, {
  timestamps: true,
});

const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;
