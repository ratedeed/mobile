const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderOnModel',
    required: true,
  },
  senderOnModel: {
    type: String,
    required: true,
    enum: ['User', 'Contractor'],
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientOnModel',
    required: true,
  },
  recipientOnModel: {
    type: String,
    required: true,
    enum: ['User', 'Contractor'],
  },
  messageText: {
    type: String,
    required: true,
    trim: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
}, {
  timestamps: true,
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;