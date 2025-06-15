const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'participantModel', // Dynamically reference User or Contractor
      required: true,
    },
  ],
  participantModel: {
    type: String,
    required: true,
    enum: ['User', 'Contractor'], // Specify possible models
  },
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

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;