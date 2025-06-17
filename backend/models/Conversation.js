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

// Pre-save hook to sort participants by their _id before saving
conversationSchema.pre('save', function(next) {
  if (this.isModified('participants') || this.isNew) {
    this.participants.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
  }
  next();
});

// Add a unique compound index on the sorted participant _ids
// This ensures that there's only one conversation document for any given pair of participants,
// regardless of their original order in the array.
conversationSchema.index(
  { 'participants._id': 1 },
  { unique: true, partialFilterExpression: { 'participants.1': { $exists: true } } }
);

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;