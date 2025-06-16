const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [
    {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      participantModel: {
        type: String,
        required: true,
        enum: ['User', 'Contractor'],
      },
    },
  ],
  name: {
    type: String,
    required: false, // Can be auto-generated or user-defined
  },
  lastMessage: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Add a unique compound index to ensure only one conversation between two specific participants
conversationSchema.index({ 'participants._id': 1 }, { unique: true });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;