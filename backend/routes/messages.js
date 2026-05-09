const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Add this line
const Message = require('../models/Message');
const Conversation = require('../models/Conversation'); // Import Conversation model
const User = require('../models/User');
const Contractor = require('../models/Contractor');
const { protect } = require('../middleware/authMiddleware'); // Import protect middleware

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
router.post('/', protect, async (req, res) => {
    console.log('Backend: Received message request body:', req.body);
    const { recipientId, messageText, attachmentUrl } = req.body;
    
    if (!recipientId) {
        return res.status(400).json({ message: 'Please provide recipientId' });
    }
    if (!messageText && !attachmentUrl) {
        return res.status(400).json({ message: 'Please provide messageText or attachmentUrl' });
    }

    try {
        let actualSenderId;
        let senderOnModel;
        let senderUserForSocket = req.user; // Default to req.user for socket room ID

        // Determine actualSenderId and senderOnModel
        if (req.user.role === 'contractor') {
            const senderContractor = await Contractor.findOne({ user: req.user._id });
            if (!senderContractor) {
                return res.status(404).json({ message: 'Sender Contractor profile not found' });
            }
            actualSenderId = senderContractor._id;
            senderOnModel = 'Contractor';
            // For socket room, we still use the User's _id
            senderUserForSocket = req.user;
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

        // Determine participants for conversation (always User IDs for sorting)
        const participantUserIds = [senderUserForSocket._id, recipientUserForSocket._id].map(id => id.toString()).sort();
        
        // Determine participant models, ensuring order matches sorted participantUserIds
        const participantModels = [];
        if (participantUserIds[0] === senderUserForSocket._id.toString()) {
            participantModels.push(senderOnModel);
            participantModels.push(recipientOnModel);
        } else {
            participantModels.push(recipientOnModel);
            participantModels.push(senderOnModel);
        }

        // Find or create conversation
        // Build participant objects matching the Conversation schema { _id, participantModel }
        const participantObjects = participantUserIds.map((uid, idx) => ({
            _id: uid,
            participantModel: participantModels[idx] || 'User'
        }));
        let conversation = await Conversation.findOneAndUpdate(
            {
                participants: { $all: participantObjects }
            },
            {
                $setOnInsert: {
                    participants: participantObjects,
                },
                $set: { lastMessageAt: new Date() } // Update last message timestamp
            },
            { upsert: true, new: true }
        );

        const message = new Message({
            conversation: conversation._id, // Fixed: use 'conversation' instead of 'conversationId'
            senderId: actualSenderId,
            recipientId: actualRecipientId,
            senderOnModel,
            recipientOnModel,
            messageText: messageText || '',
            attachmentUrl: attachmentUrl || null,
        });

        const createdMessage = await message.save();

        // Populate recipientId and conversation before sending back to frontend
        const populatedMessage = await Message.findById(createdMessage._id)
            .populate({
                path: 'recipientId',
                select: '_id firstName lastName businessName profilePicture role', // Ensure businessName is selected
                refPath: 'recipientOnModel'
            })
            .populate({
                path: 'conversation',
                select: '_id participants' // Populate conversation details
            })
            .exec();

        // Manually add sender details for the frontend response
        let senderDetailsForFrontend;
        if (senderOnModel === 'Contractor') {
            const senderContractorProfile = await Contractor.findById(actualSenderId).select('_id firstName lastName businessName profilePicture user');
            // Also get the linked User's firstName/lastName if needed for display
            const linkedUser = await User.findById(req.user._id).select('firstName lastName');
            senderDetailsForFrontend = {
                _id: actualSenderId,
                firstName: senderContractorProfile?.firstName || (linkedUser ? linkedUser.firstName : ''),
                lastName: senderContractorProfile?.lastName || (linkedUser ? linkedUser.lastName : ''),
                businessName: senderContractorProfile?.businessName || '',
                profilePicture: senderContractorProfile?.profilePicture || '',
                role: 'Contractor' // Standardized to 'Contractor' (capitalized)
            };
        } else {
            senderDetailsForFrontend = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                profilePicture: req.user.profilePicture,
                role: req.user.role
            };
        }

        const finalMessageForFrontend = {
            ...populatedMessage.toObject(),
            senderId: senderDetailsForFrontend,
            conversationId: populatedMessage.conversation?._id || populatedMessage.conversation // Ensure conversationId is set
        };

        console.log('Backend: Final message sent to frontend:', JSON.stringify(finalMessageForFrontend, null, 2));
        res.status(201).json(finalMessageForFrontend);

        // Emit the new message via Socket.IO
        const io = req.app.get('socketio');
        const activeUsers = req.app.get('activeUsers');
        console.log('Backend: Current active users map:', JSON.stringify(Array.from(activeUsers.entries())));

        // Socket room IDs are always based on the User's _id
        const senderSocketRoomId = senderUserForSocket._id.toString();
        const recipientSocketRoomId = recipientUserForSocket._id.toString();

        console.log('Backend: Recipient actual ID for emission (socket room):', recipientSocketRoomId);

        const recipientSocketInfo = activeUsers.get(recipientSocketRoomId);
        if (recipientSocketInfo) {
            console.log(`Backend: Recipient ${recipientSocketRoomId} is active with socket ID: ${recipientSocketInfo.socketId}`);
        } else {
            console.log(`Backend: Recipient ${recipientSocketRoomId} is NOT currently active.`);
        }

        // Emit to both sender and recipient rooms
        io.to(senderSocketRoomId).emit('newMessage', finalMessageForFrontend);
        console.log(`Backend: Emitted newMessage to sender room: ${senderSocketRoomId}`);

        io.to(recipientSocketRoomId).emit('newMessage', finalMessageForFrontend);
        console.log(`Backend: Emitted newMessage to recipient room: ${recipientSocketRoomId}`);

          // Create and emit notification for the recipient
          const Notification = require('../models/Notification');
          const { sendPushNotification } = require('../utils/pushNotifications');
          
          const notification = await Notification.create({
            recipient: recipientUserForSocket._id,
            recipientModel: 'User', // Notifications are always linked to the User document
            sender: actualSenderId,
            senderModel: senderOnModel,
            message: `New message from ${senderDetailsForFrontend.firstName} ${senderDetailsForFrontend.lastName}`,
            type: 'new_message',
            link: `/messages/${conversation._id}`
          });
          
          if (io) {
            console.log(`Backend: Emitting newNotification to user room: ${recipientSocketRoomId}`);
            io.to(recipientSocketRoomId).emit('newNotification', notification);
          }

          // SEND REAL PUSH NOTIFICATION (for locked screens)
          // SYNC: We send push notification if the user has a token.
          console.log(`Backend: Recipient pushToken check for ${recipientUserForSocket._id}: ${recipientUserForSocket.pushToken ? 'Token present' : 'NO TOKEN'}`);
          if (recipientUserForSocket.pushToken) {
            console.log(`Backend: Attempting to send push notification to user: ${recipientUserForSocket._id}`);

            const senderName = senderOnModel === 'Contractor'
                ? (senderDetailsForFrontend.businessName || senderDetailsForFrontend.companyName || `${senderDetailsForFrontend.firstName} ${senderDetailsForFrontend.lastName}`)
                : `${senderDetailsForFrontend.firstName} ${senderDetailsForFrontend.lastName}`;

            // Calculate unread count for badge
            const unreadNotifCount = await Notification.countDocuments({ recipient: recipientUserForSocket._id, read: false });
            const unreadMsgCount = await Message.countDocuments({ recipientId: recipientUserForSocket._id, read: false });
            const totalUnread = unreadNotifCount + unreadMsgCount;

            await sendPushNotification(recipientUserForSocket.pushToken, {
              title: `New message from ${senderName}`,
              body: messageText.length > 100 ? `${messageText.substring(0, 97)}...` : messageText,
              badge: totalUnread,
              data: {
                type: 'new_message',
                conversationId: conversation._id.toString(),
                senderId: actualSenderId.toString()
              }
            });
          }

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
        const contractorProfile = await Contractor.findOne({ user: currentUserId });
        const currentContractorId = contractorProfile ? contractorProfile._id : null;


        const conversations = await Conversation.find({ 'participants._id': currentUserId })
            .sort({ lastMessageAt: -1 }).lean();

        // Process all conversations in parallel instead of sequential loop
        const finalConversations = await Promise.all(conversations.map(async (conv) => {
            const otherParticipant = conv.participants.find(p => p._id.toString() !== currentUserId.toString());
            const otherUserId = otherParticipant ? otherParticipant._id.toString() : null;
            const otherModel = otherParticipant ? otherParticipant.participantModel : 'User';

            let otherParticipantDetails = null;
            if (otherUserId) {
                if (otherModel === 'User') {
                    const user = await User.findById(otherUserId).select('_id firstName lastName profilePicture role').lean();
                    if (user) {
                        otherParticipantDetails = { _id: user._id, firstName: user.firstName, lastName: user.lastName, profilePicture: user.profilePicture, role: 'User' };
                    }
                } else if (otherModel === 'Contractor') {
                    const contractor = await Contractor.findOne({ user: otherUserId }).select('_id firstName lastName businessName profilePicture user isVerified isTopRated').lean();
                    if (contractor) {
                        const linkedUser = await User.findById(contractor.user).select('firstName lastName').lean();
                        otherParticipantDetails = {
                            _id: contractor.user,
                            firstName: contractor.firstName || (linkedUser ? linkedUser.firstName : ''),
                            lastName: contractor.lastName || (linkedUser ? linkedUser.lastName : ''),
                            businessName: contractor.businessName,
                            profilePicture: contractor.profilePicture,
                            isVerified: contractor.isVerified,
                            isTopRated: contractor.isTopRated,
                            role: 'Contractor'
                        };
                    }
                }
            }

            if (!otherParticipantDetails) return null;

            // Fetch last message and unread count in parallel
            const [lastMessage, unreadCount] = await Promise.all([
                Message.findOne({ conversation: conv._id })
                    .sort({ createdAt: -1 })
                    .populate({ path: 'senderId', select: '_id firstName lastName businessName profilePicture role', refPath: 'senderOnModel' })
                    .populate({ path: 'recipientId', select: '_id firstName lastName businessName profilePicture role', refPath: 'recipientOnModel' })
                    .lean(),
                Message.countDocuments({
                    conversation: conv._id,
                    recipientId: { $in: [currentUserId, currentContractorId].filter(Boolean) },
                    read: false
                })
            ]);

            return {
                conversationId: conv._id,
                participants: [
                    { _id: currentUserId, firstName: req.user.firstName, lastName: req.user.lastName, profilePicture: req.user.profilePicture, role: req.user.role },
                    otherParticipantDetails
                ],
                lastMessage: lastMessage ? {
                    _id: lastMessage._id, conversationId: lastMessage.conversation,
                    senderId: lastMessage.senderId, recipientId: lastMessage.recipientId,
                    messageText: lastMessage.messageText, timestamp: lastMessage.timestamp,
                    read: lastMessage.read, createdAt: lastMessage.createdAt, updatedAt: lastMessage.updatedAt
                } : null,
                unreadCount
            };
        }));

        res.json(finalConversations.filter(Boolean));
    } catch (error) {
        console.error('Backend: Error in GET /conversations:', error.stack);
        res.status(500).json({ message: 'Server Error', details: error.message });
    }
});

// @desc    Get messages between current user and another user/contractor
// @route   GET /api/messages/conversation/:otherUserId
// @access  Private
router.get('/conversation/:conversationId', protect, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const contractorProfile = await Contractor.findOne({ user: currentUserId });
        const currentContractorId = contractorProfile ? contractorProfile._id : null;

        const currentUserRole = req.user.role;
        const conversationId = req.params.conversationId;

        // Validate conversationId
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
            return res.status(400).json({ message: 'Invalid conversation ID' });
        }

        // Find the conversation to ensure the current user is a participant
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Check if the current user is part of this conversation
        const isParticipant = conversation.participants.some(pId => pId.toString() === currentUserId.toString());
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not authorized to view this conversation' });
        }

        const messages = await Message.find({ conversation: conversationId }).sort('createdAt').lean();

        // Batch-collect all unique user/contractor IDs to avoid N+1 queries
        const userIds = new Set();
        const contractorUserIds = new Set();
        const contractorIds = new Set();

        for (const msg of messages) {
            if (msg.senderOnModel === 'User' && msg.senderId) userIds.add(msg.senderId.toString());
            if (msg.senderOnModel === 'Contractor' && msg.senderId) contractorUserIds.add(msg.senderId.toString());
            if (msg.recipientOnModel === 'User' && msg.recipientId) userIds.add(msg.recipientId.toString());
            if (msg.recipientOnModel === 'Contractor' && msg.recipientId) contractorIds.add(msg.recipientId.toString());
        }

        // Fetch all users and contractors in bulk
        const [users, contractorsByUser, contractorsById] = await Promise.all([
            User.find({ _id: { $in: [...userIds] } }).select('_id firstName lastName profilePicture role').lean(),
            Contractor.find({ user: { $in: [...contractorUserIds] } }).select('_id firstName lastName businessName profilePicture user').lean(),
            Contractor.find({ _id: { $in: [...contractorIds] } }).select('_id firstName lastName businessName profilePicture user').lean(),
        ]);

        const userMap = new Map(users.map(u => [u._id.toString(), u]));
        const contractorByUserMap = new Map(contractorsByUser.map(c => [c.user.toString(), c]));
        const contractorByIdMap = new Map(contractorsById.map(c => [c._id.toString(), c]));

        // Resolve sender/recipient details from cached maps
        const resolveUser = (id) => userMap.get(id.toString()) || null;
        const resolveContractor = (id) => {
            let c = contractorByUserMap.get(id.toString());
            if (!c) c = contractorByIdMap.get(id.toString());
            if (!c) return null;
            const u = c.user ? resolveUser(c.user) : null;
            return { _id: c._id, firstName: c.firstName || (u ? u.firstName : ''), lastName: c.lastName || (u ? u.lastName : ''), businessName: c.businessName || '', profilePicture: c.profilePicture, role: 'Contractor' };
        };

        const populatedMessages = messages.map(msg => {
            const m = { ...msg };
            if (m.senderOnModel === 'User') m.senderId = resolveUser(m.senderId) || {};
            else if (m.senderOnModel === 'Contractor') m.senderId = resolveContractor(m.senderId) || {};
            else m.senderId = {};

            if (m.recipientOnModel === 'User') m.recipientId = resolveUser(m.recipientId) || {};
            else if (m.recipientOnModel === 'Contractor') m.recipientId = resolveContractor(m.recipientId) || {};
            else m.recipientId = {};
            return m;
        });

        // Batch mark unread messages as read (single query instead of N individual updates)
        await Message.updateMany(
            { conversation: conversationId, recipientId: { $in: [currentUserId, currentContractorId].filter(Boolean) }, read: false },
            { $set: { read: true } }
        );
        populatedMessages.forEach(msg => { msg.read = true; });
        res.json(populatedMessages);
    } catch (error) {
        console.error('Backend: Error in GET /messages/conversation/:conversationId:', error.stack);
        res.status(500).json({ message: 'Server Error', details: error.message });
    }
});

// @desc    Mark messages as read
// @route   PUT /api/messages/read/:messageId
// @access  Private
router.put('/read-conversation/:conversationId', protect, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user._id;
        const contractorProfile = await Contractor.findOne({ user: currentUserId });
        const currentContractorId = contractorProfile ? contractorProfile._id : null;

        // Find the conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Ensure the current user is a participant in this conversation
        const isParticipant = conversation.participants.some(p => p._id.toString() === currentUserId.toString());
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not authorized to mark messages in this conversation as read' });
        }

        // Mark all messages in this conversation as read for the current user (as recipient)
        // Check for both User ID and Contractor ID
        await Message.updateMany(
            {
                conversation: conversationId,
                recipientId: { $in: [currentUserId, currentContractorId].filter(Boolean) }, 
                read: false
            },
            { $set: { read: true } }
        );

        res.json({ message: 'Messages in conversation marked as read' });
    } catch (error) {
        console.error('Backend: Error in PUT /read-conversation/:conversationId:', error.stack);
        res.status(500).json({ message: 'Server Error', details: error.message });
    }
});

// @desc    Find or create a conversation
// @route   POST /api/messages/find-or-create-conversation
// @access  Private
router.post('/find-or-create-conversation', protect, async (req, res) => {
    const { participantIds } = req.body; // Expecting an array of two participant IDs (User _ids)

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length !== 2) {
        return res.status(400).json({ message: 'Please provide an array of two participant IDs.' });
    }

    console.log('Backend: find-or-create-conversation: Received participantIds:', participantIds);
    const [id1, id2] = participantIds.sort(); // Sort to ensure consistent order

    try {
        // Helper to find a participant by ID, checking both User and Contractor models
        const findParticipant = async (id) => {
            let user = await User.findById(id);
            if (user) {
                console.log(`Backend: findParticipant: Found User with ID ${id}`);
                return { id: user._id, model: 'User', linkedUser: user };
            }

            let contractor = await Contractor.findById(id);
            if (contractor) {
                console.log(`Backend: findParticipant: Found Contractor with ID ${id}`);
                // If it's a contractor, we need its linked user ID for the conversation participants array
                const linkedUser = await User.findById(contractor.user);
                if (linkedUser) {
                    console.log(`Backend: findParticipant: Contractor ${id} linked to User ${linkedUser._id}`);
                    return { id: contractor._id, model: 'Contractor', linkedUser: linkedUser };
                } else {
                    console.warn(`Backend: findParticipant: Contractor ${id} has no linked User.`);
                    return null; // Contractor found but no linked user
                }
            }
            console.log(`Backend: findParticipant: No User or Contractor found for ID ${id}`);
            return null;
        };

        const participant1Details = await findParticipant(id1);
        console.log('Backend: find-or-create-conversation: Participant 1 details:', participant1Details);
        if (!participant1Details) {
            return res.status(404).json({ message: `Participant 1 (${id1}) not found.` });
        }

        const participant2Details = await findParticipant(id2);
        console.log('Backend: find-or-create-conversation: Participant 2 details:', participant2Details);
        if (!participant2Details) {
            return res.status(404).json({ message: `Participant 2 (${id2}) not found.` });
        }


        // Build participant objects matching the Conversation schema { _id, participantModel }
        // Always use the linked User's _id as the participant _id (for consistent lookups)
        const p1Id = participant1Details.linkedUser._id.toString();
        const p2Id = participant2Details.linkedUser._id.toString();
        const [firstId, secondId] = p1Id < p2Id ? [p1Id, p2Id] : [p2Id, p1Id];
        const firstModel = p1Id < p2Id ? participant1Details.model : participant2Details.model;
        const secondModel = p1Id < p2Id ? participant2Details.model : participant1Details.model;

        const participantObjects = [
            { _id: firstId, participantModel: firstModel },
            { _id: secondId, participantModel: secondModel }
        ];

        console.log(`Backend: find-or-create-conversation: Participants:`, participantObjects);

        let conversation = await Conversation.findOneAndUpdate(
            {
                participants: { $all: participantObjects }
            },
            {
                $setOnInsert: {
                    participants: participantObjects,
                },
                $set: { lastMessageAt: new Date() } // Update last message timestamp
            },
            { upsert: true, new: true }
        );

        // Return full participant details for the frontend to use
        const participantsWithDetails = [];
        for (const p of participantObjects) {
            const pId = p._id;
            const participantModelType = p.participantModel;
            let details;
            if (participantModelType === 'User') {
                details = await User.findById(pId).select('_id firstName lastName profilePicture role');
            } else if (participantModelType === 'Contractor') {
                // Find the Contractor profile linked to this User ID
                const contractorProfile = await Contractor.findOne({ user: pId }).select('_id firstName lastName businessName profilePicture user');
                console.log('DEBUG: find-or-create-conversation - Fetched contractor profile for participant:', JSON.stringify(contractorProfile, null, 2)); // Add this log
                if (contractorProfile) {
                    // Get linked User's firstName/lastName for display if available
                    const linkedUser = await User.findById(contractorProfile.user).select('firstName lastName');
                    details = {
                        _id: contractorProfile._id,
                        firstName: contractorProfile.firstName || (linkedUser ? linkedUser.firstName : ''),
                        lastName: contractorProfile.lastName || (linkedUser ? linkedUser.lastName : ''),
                        businessName: contractorProfile.businessName,
                        profilePicture: contractorProfile.profilePicture,
                        role: 'Contractor'
                    };
                }
            }
            if (details) {
                participantsWithDetails.push(details);
            }
        }

        res.status(200).json({
            conversationId: conversation._id,
            participants: participantsWithDetails
        });

    } catch (error) {
        console.error('Backend: Error in /find-or-create-conversation:', error.stack);
        res.status(500).json({ message: 'Server Error', details: error.message });
    }
});

module.exports = router;