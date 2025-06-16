const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Add this line
const Message = require('../models/Message');
const User = require('../models/User');
const Contractor = require('../models/Contractor');
const { protect } = require('../middleware/authMiddleware'); // Import protect middleware

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
router.post('/', protect, async (req, res) => {
    const { recipientId, messageText } = req.body;
    if (!recipientId || !messageText) {
        return res.status(400).json({ message: 'Please provide recipientId and messageText' });
    }
 
    try {
        let actualSenderId;
        let senderOnModel;
 
        // Determine actualSenderId and senderOnModel
        if (req.user.role === 'contractor') {
            const senderContractor = await Contractor.findOne({ user: req.user._id });
            if (!senderContractor) {
                return res.status(404).json({ message: 'Sender Contractor profile not found' });
            }
            actualSenderId = senderContractor._id;
            senderOnModel = 'Contractor';
        } else {
            actualSenderId = req.user._id;
            senderOnModel = 'User';
        }
 
        let recipientUser = await User.findById(recipientId);
        let recipientContractor = null;
 
        if (!recipientUser) {
            // If not a User, try to find a Contractor by their Contractor profile ID
            recipientContractor = await Contractor.findById(recipientId);
        }
 
        if (!recipientUser && !recipientContractor) {
            return res.status(404).json({ message: 'Recipient not found' });
        }
 
        let actualRecipientId;
        let recipientOnModel;
        let recipientUserForSocket; // To store the User document of the recipient for socket room ID
 
        if (recipientUser) {
            actualRecipientId = recipientUser._id;
            recipientOnModel = 'User';
            recipientUserForSocket = recipientUser;
        } else if (recipientContractor) {
            actualRecipientId = recipientContractor._id;
            recipientOnModel = 'Contractor';
            // Get the linked User document for the contractor to use its _id for the socket room
            recipientUserForSocket = await User.findById(recipientContractor.user);
            if (!recipientUserForSocket) {
                return res.status(404).json({ message: 'Recipient Contractor\'s linked User not found' });
            }
        } else {
            // This case should ideally not be reached due to the check above
            return res.status(404).json({ message: 'Recipient not found' });
        }
 
 
               // Determine the canonical User IDs for both sender and recipient
               const senderUserCanonicalId = req.user._id; // This is always the User's _id
               const recipientUserCanonicalId = recipientUserForSocket._id; // This is the User's _id linked to the recipient
       
               console.log(`Backend: Sender Canonical User ID: ${senderUserCanonicalId}`);
               console.log(`Backend: Recipient Canonical User ID: ${recipientUserCanonicalId}`);
       
               // Find an existing conversation between these two canonical User IDs
               let conversation = await Conversation.findOne({
                   'participants._id': { $all: [senderUserCanonicalId, recipientUserCanonicalId] },
                   'participants': { $size: 2 } // Ensure it's a direct 1-to-1 conversation
               });
       
               if (!conversation) {
                   console.log('Backend: No existing conversation found. Creating a new one.');
                   // Create a new conversation if one doesn't exist
                   conversation = new Conversation({
                       participants: [
                           { _id: senderUserCanonicalId, participantModel: 'User' },
                           { _id: recipientUserCanonicalId, participantModel: 'User' }
                       ],
                       lastMessage: messageText,
                       timestamp: new Date(),
                   });
                   await conversation.save();
                   console.log('Backend: New conversation created:', conversation._id);
               } else {
                   console.log('Backend: Existing conversation found:', conversation._id);
                   // Update last message and timestamp for existing conversation
                   conversation.lastMessage = messageText;
                   conversation.timestamp = new Date();
                   await conversation.save();
                   console.log('Backend: Existing conversation updated.');
               }
       
               const message = new Message({
                   senderId: actualSenderId,
                   senderOnModel,
                   recipientId: actualRecipientId,
                   recipientOnModel,
                   messageText,
                   conversation: conversation._id, // Link message to conversation
               });
       
               const createdMessage = await message.save();
       
               // Populate senderId and recipientId before sending back to frontend
               const populatedMessage = await Message.findById(createdMessage._id)
                   .populate({
                       path: 'senderId',
                       select: '_id firstName lastName companyName profilePicture role',
                       refPath: 'senderOnModel'
                   })
                   .populate({
                       path: 'recipientId',
                       select: '_id firstName lastName companyName profilePicture role',
                       refPath: 'recipientOnModel'
                   })
                   .populate({
                       path: 'conversation', // Populate the conversation field
                       select: '_id participants', // Select relevant fields from conversation
                   })
                   .exec();
       
               console.log('Backend: Final message sent to frontend:', JSON.stringify(populatedMessage.toObject(), null, 2));
               res.status(201).json(populatedMessage.toObject());
       
               // Emit the new message via Socket.IO
               const io = req.app.get('socketio');
               const activeUsers = req.app.get('activeUsers');
               console.log('Backend: Current active users map:', JSON.stringify(Array.from(activeUsers.entries())));
       
               // Socket room IDs are always based on the User's _id
               const senderSocketRoomId = req.user._id.toString();
               const recipientSocketRoomId = recipientUserForSocket._id.toString();
       
               console.log('Backend: Recipient actual ID for emission (socket room):', recipientSocketRoomId);
       
               const recipientSocketInfo = activeUsers.get(recipientSocketRoomId);
               if (recipientSocketInfo) {
                   console.log(`Backend: Recipient ${recipientSocketRoomId} is active with socket ID: ${recipientSocketInfo.socketId}`);
               } else {
                   console.log(`Backend: Recipient ${recipientSocketRoomId} is NOT currently active.`);
               }
       
               io.to(senderSocketRoomId).emit('newMessage', populatedMessage.toObject());
               console.log(`Backend: Emitted newMessage to sender room: ${senderSocketRoomId}`);
       
               io.to(recipientSocketRoomId).emit('newMessage', populatedMessage.toObject());
               console.log(`Backend: Emitted newMessage to recipient room: ${recipientSocketRoomId}`);
       
           } catch (error) {
               console.error('Backend: Error sending message:', error.stack);
               res.status(500).json({ message: 'Server Error', details: error.message });
           }
       });
       
       // @desc    Get all conversations for the current user
       // @route   GET /api/messages/conversations
       // @access  Private
       router.get('/conversations', protect, async (req, res) => {
           try {
               const currentUserId = req.user._id;
               const currentUserRole = req.user.role;
               console.log(`Backend: GET /conversations - currentUserId: ${currentUserId}, role: ${currentUserRole}`);
       
               // Find conversations where the current user is a participant
               const conversations = await Conversation.find({
                   'participants._id': currentUserId
               })
                   .populate({
                       path: 'participants._id', // Populate the _id within the participants array
                       select: '_id firstName lastName companyName profilePicture role',
                       // refPath is not directly supported for array elements with dynamic refs in populate,
                       // so we'll handle the role determination in the mapping below.
                   })
                   .sort({ timestamp: -1 }); // Sort by most recent message timestamp
       
               const finalConversations = [];
       
               for (const conv of conversations) {
                   const otherParticipantInfo = conv.participants.find(p => p._id._id.toString() !== currentUserId.toString());
       
                   if (otherParticipantInfo) {
                       // Determine the actual model of the other participant to get correct role/fields
                       let otherParticipantPopulated;
                       if (otherParticipantInfo.participantModel === 'Contractor') {
                           otherParticipantPopulated = await Contractor.findById(otherParticipantInfo._id._id).select('firstName lastName companyName profilePicture user');
                           if (otherParticipantPopulated) {
                               otherParticipantPopulated = { ...otherParticipantPopulated.toObject(), role: 'Contractor' };
                           }
                       } else {
                           otherParticipantPopulated = await User.findById(otherParticipantInfo._id._id).select('firstName lastName profilePicture');
                           if (otherParticipantPopulated) {
                               otherParticipantPopulated = { ...otherParticipantPopulated.toObject(), role: 'User' };
                           }
                       }
       
                       // Get the last message in this conversation
                       const lastMessage = await Message.findOne({ conversation: conv._id })
                           .sort({ createdAt: -1 })
                           .populate({
                               path: 'senderId',
                               select: '_id firstName lastName companyName profilePicture role',
                               refPath: 'senderOnModel'
                           })
                           .populate({
                               path: 'recipientId',
                               select: '_id firstName lastName companyName profilePicture role',
                               refPath: 'recipientOnModel'
                           })
                           .exec();
       
                       // Calculate unread count for the current user in this conversation
                       const unreadCount = await Message.countDocuments({
                           conversation: conv._id,
                           recipientId: currentUserId, // Current user is the recipient
                           read: false
                       });
       
                       if (otherParticipantPopulated && lastMessage) {
                           finalConversations.push({
                               _id: conv._id,
                               lastMessage: lastMessage,
                               unreadCount: unreadCount,
                               otherParticipant: otherParticipantPopulated,
                               participants: [
                                   otherParticipantPopulated,
                                   {
                                       _id: currentUserId,
                                       firstName: req.user.firstName, // Assuming req.user has these fields
                                       lastName: req.user.lastName,
                                       profilePicture: req.user.profilePicture,
                                       role: currentUserRole
                                   }
                               ]
                           });
                       }
                   }
               }
       
               console.log('Backend: Final conversations to be sent:', finalConversations);
               res.json(finalConversations);
           } catch (error) {
               console.error('Backend: Error in GET /conversations:', error.stack); // Log the full stack trace
               res.status(500).json({ message: 'Server Error', details: error.message }); // Send error message to frontend
           }
       });
       
       // @desc    Get messages between current user and another user/contractor
       // @route   GET /api/messages/conversation/:otherUserId
       // @access  Private
       router.get('/conversation/:otherUserId', protect, async (req, res) => {
           try {
               const currentUserId = req.user._id; // This is the User's _id
               const otherParticipantIdParam = req.params.otherUserId; // This could be User or Contractor ID
       
               // Find the canonical User ID of the other participant
               let otherUserCanonicalId;
               let otherUserIsUser = await User.findById(otherParticipantIdParam);
               let otherUserIsContractor = null;
       
               if (otherUserIsUser) {
                   otherUserCanonicalId = otherUserIsUser._id;
               } else {
                   otherUserIsContractor = await Contractor.findById(otherParticipantIdParam);
                   if (otherUserIsContractor) {
                       otherUserCanonicalId = otherUserIsContractor.user; // Get the linked User ID
                   } else {
                       return res.status(404).json({ message: 'Other participant not found' });
                   }
               }
       
               // Find the conversation between the current user and the other participant
               const conversation = await Conversation.findOne({
                   'participants._id': { $all: [currentUserId, otherUserCanonicalId] },
                   'participants': { $size: 2 }
               });
       
               if (!conversation) {
                   return res.status(200).json([]); // No conversation found, return empty array of messages
               }
       
               const messages = await Message.find({ conversation: conversation._id })
                   .populate({
                       path: 'senderId',
                       select: '_id firstName lastName companyName profilePicture role',
                       refPath: 'senderOnModel'
                   })
                   .populate({
                       path: 'recipientId',
                       select: '_id firstName lastName companyName profilePicture role',
                       refPath: 'recipientOnModel'
                   })
                   .sort('createdAt');
       
               const populatedMessages = messages.map(msg => msg.toObject());
       
               for (const msg of populatedMessages) {
                   // Mark as read only if the current user is the recipient of this specific message
                   if (msg.recipientId && msg.recipientId._id && msg.recipientId._id.toString() === currentUserId.toString() && !msg.read) {
                       // Find the actual message document to update its 'read' status
                       const messageToUpdate = await Message.findById(msg._id);
                       if (messageToUpdate) {
                           messageToUpdate.read = true;
                           await messageToUpdate.save();
                       }
                       msg.read = true; // Update the object in the array for the current response
                   }
               }
               res.json(populatedMessages);
           } catch (error) {
               console.error('Backend: Error in GET /messages/conversation/:otherUserId:', error.stack);
               res.status(500).json({ message: 'Server Error', details: error.message });
           }
       });
       
       // @desc    Mark messages as read
       // @route   PUT /api/messages/read/:messageId
       // @access  Private
       router.put('/read/:messageId', protect, async (req, res) => {
           try {
               const message = await Message.findById(req.params.messageId);
       
               if (!message) {
                   return res.status(404).json({ message: 'Message not found' });
               }
       
               // Only allow recipient to mark as read
               // The recipientId on the message can be a User or Contractor ID.
               // We need to compare it to the current user's User ID or Contractor ID.
               let isRecipient = false;
               if (message.recipientOnModel === 'User' && message.recipientId.toString() === req.user._id.toString()) {
                   isRecipient = true;
               } else if (message.recipientOnModel === 'Contractor') {
                   const contractorProfile = await Contractor.findOne({ user: req.user._id });
                   if (contractorProfile && message.recipientId.toString() === contractorProfile._id.toString()) {
                       isRecipient = true;
                   }
               }
       
               if (!isRecipient) {
                   return res.status(401).json({ message: 'Not authorized to mark this message as read' });
               }
       
               message.read = true;
               await message.save();
       
               res.json({ message: 'Message marked as read' });
           } catch (error) {
               console.error('Backend: Error in PUT /read/:messageId:', error.stack); // Log the full stack trace
               res.status(500).json({ message: 'Server Error', details: error.message }); // Send error message to frontend
           }
       });