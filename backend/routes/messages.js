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
    console.log('Backend: Received message request body:', req.body); // Add this log
    const { recipientId, messageText } = req.body;
    if (!recipientId || !messageText) {
        return res.status(400).json({ message: 'Please provide recipientId and messageText' });
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
        let conversation = await Conversation.findOneAndUpdate(
            {
                participants: { $all: participantUserIds }
            },
            {
                $setOnInsert: {
                    participants: participantUserIds,
                    participantModels: participantModels // Store the models for each participant
                },
                $set: { lastMessageAt: new Date() } // Update last message timestamp
            },
            { upsert: true, new: true }
        );

        const message = new Message({
            conversationId: conversation._id, // Assign the canonical conversation ID
            senderId: actualSenderId,
            recipientId: actualRecipientId,
            senderOnModel,
            recipientOnModel,
            messageText,
        });

        const createdMessage = await message.save();

        // Populate recipientId and conversationId before sending back to frontend
        const populatedMessage = await Message.findById(createdMessage._id)
            .populate({
                path: 'recipientId',
                select: '_id firstName lastName businessName profilePicture role', // Ensure businessName is selected
                refPath: 'recipientOnModel'
            })
            .populate({
                path: 'conversationId',
                select: '_id participants' // Populate conversation details
            })
            .exec();

        // Manually add sender details for the frontend response
        let senderDetailsForFrontend;
        if (senderOnModel === 'Contractor') {
            const senderContractorProfile = await Contractor.findById(actualSenderId).select('_id firstName lastName businessName profilePicture'); // Changed companyName to businessName
            // Also get the linked User's firstName/lastName if needed for display
            const linkedUser = await User.findById(req.user._id).select('firstName lastName');
            senderDetailsForFrontend = {
                _id: senderContractorProfile._id,
                firstName: senderContractorProfile.firstName || (linkedUser ? linkedUser.firstName : ''),
                lastName: senderContractorProfile.lastName || (linkedUser ? linkedUser.lastName : ''),
                businessName: senderContractorProfile.businessName, // Changed companyName to businessName
                profilePicture: senderContractorProfile.profilePicture,
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
            conversationId: populatedMessage.conversationId._id // Ensure conversationId is just the ID
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
 
        // Find all conversations where the current user is a participant
        const conversations = await Conversation.find({ participants: currentUserId })
            .sort({ lastMessageAt: -1 }); // Sort by most recent message in the conversation

        const finalConversations = [];

        for (const conv of conversations) {
            // Determine the other participant's User ID in the conversation
            const otherParticipantUserId = conv.participants.find(pId => pId.toString() !== currentUserId.toString());

            let otherParticipantDetails = null;
            if (otherParticipantUserId) {
                // Find the index of the other participant's User ID in the sorted participants array
                const otherParticipantIndex = conv.participants.findIndex(pId => pId.toString() === otherParticipantUserId.toString());
                const otherParticipantModelType = conv.participantModels[otherParticipantIndex];

                if (otherParticipantModelType === 'User') {
                    const user = await User.findById(otherParticipantUserId).select('_id firstName lastName profilePicture role');
                    if (user) {
                        otherParticipantDetails = {
                            _id: user._id,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            profilePicture: user.profilePicture,
                            role: 'User'
                        };
                    }
                } else if (otherParticipantModelType === 'Contractor') {
                    // Find the Contractor profile linked to this User ID
                    const contractor = await Contractor.findOne({ user: otherParticipantUserId }).select('_id firstName lastName businessName profilePicture user'); // Changed companyName to businessName
                    if (contractor) {
                        // Get linked User's firstName/lastName for display if available
                        const linkedUser = await User.findById(contractor.user).select('firstName lastName');
                        otherParticipantDetails = {
                            _id: contractor._id,
                            firstName: contractor.firstName || (linkedUser ? linkedUser.firstName : ''),
                            lastName: contractor.lastName || (linkedUser ? linkedUser.lastName : ''),
                            businessName: contractor.businessName, // Changed companyName to businessName
                            profilePicture: contractor.profilePicture,
                            role: 'Contractor'
                        };
                    }
                }
            }

            if (!otherParticipantDetails) {
                console.warn(`Backend: Could not find details for other participant in conversation ${conv._id}`);
                continue; // Skip this conversation if other participant details are missing
            }

            // Get the last message for this conversation
            const lastMessage = await Message.findOne({ conversationId: conv._id })
                .sort({ createdAt: -1 })
                .populate({
                    path: 'senderId',
                    select: '_id firstName lastName businessName profilePicture role', // Ensure businessName is selected
                    refPath: 'senderOnModel'
                })
                .populate({
                    path: 'recipientId',
                    select: '_id firstName lastName businessName profilePicture role', // Ensure businessName is selected
                    refPath: 'recipientOnModel'
                })
                .exec();

            // Calculate unread count for the current user in this conversation
            const unreadCount = await Message.countDocuments({
                conversationId: conv._id,
                recipientId: currentUserId, // Current user is the recipient
                read: false
            });

            // Construct the conversation object for the frontend
            finalConversations.push({
                conversationId: conv._id,
                participants: [
                    {
                        _id: currentUserId,
                        firstName: req.user.firstName,
                        lastName: req.user.lastName,
                        profilePicture: req.user.profilePicture,
                        role: req.user.role
                    },
                    otherParticipantDetails
                ],
                lastMessage: lastMessage ? {
                    _id: lastMessage._id,
                    conversationId: lastMessage.conversationId,
                    senderId: lastMessage.senderId,
                    recipientId: lastMessage.recipientId,
                    messageText: lastMessage.messageText,
                    timestamp: lastMessage.timestamp,
                    read: lastMessage.read,
                    createdAt: lastMessage.createdAt,
                    updatedAt: lastMessage.updatedAt
                } : null,
                unreadCount: unreadCount
            });
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
router.get('/conversation/:conversationId', protect, async (req, res) => {
    try {
        const currentUserId = req.user._id;
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

        const messages = await Message.find({ conversationId: conversationId }).sort('createdAt');

        const populatedMessages = await Promise.all(messages.map(async (msg) => {
            const msgObj = msg.toObject();

            // Populate sender details
            if (msgObj.senderId) {
                let senderDetails;
                if (msgObj.senderOnModel === 'User') {
                    senderDetails = await User.findById(msgObj.senderId).select('_id firstName lastName profilePicture role');
                } else if (msgObj.senderOnModel === 'Contractor') {
                    senderDetails = await Contractor.findById(msgObj.senderId).select('_id firstName lastName businessName profilePicture role');
                    console.log('DEBUG: GET /conversation/:conversationId - Fetched sender contractor details:', JSON.stringify(senderDetails, null, 2));
                    // If it's a contractor, also try to get firstName/lastName from the linked User model
                    // Prioritize contractor's own name, then linked user's
                    if (senderDetails && senderDetails.user) {
                        const linkedUser = await User.findById(senderDetails.user).select('firstName lastName');
                        senderDetails.firstName = senderDetails.firstName || (linkedUser ? linkedUser.firstName : '');
                        senderDetails.lastName = senderDetails.lastName || (linkedUser ? linkedUser.lastName : '');
                    }
                    // Ensure businessName is explicitly set for the frontend
                    senderDetails.businessName = senderDetails.businessName || '';
                }
                msgObj.senderId = senderDetails || {};
            } else {
                msgObj.senderId = {};
            }

            // Populate recipient details
            if (msgObj.recipientId) {
                let recipientDetails;
                if (msgObj.recipientOnModel === 'User') {
                    recipientDetails = await User.findById(msgObj.recipientId).select('_id firstName lastName profilePicture role');
                } else if (msgObj.recipientOnModel === 'Contractor') {
                    recipientDetails = await Contractor.findById(msgObj.recipientId).select('_id firstName lastName businessName profilePicture role');
                    console.log('DEBUG: GET /conversation/:conversationId - Fetched recipient contractor details:', JSON.stringify(recipientDetails, null, 2));
                    // If it's a contractor, also try to get firstName/lastName from the linked User model
                    // Prioritize contractor's own name, then linked user's
                    if (recipientDetails && recipientDetails.user) {
                        const linkedUser = await User.findById(recipientDetails.user).select('firstName lastName');
                        recipientDetails.firstName = recipientDetails.firstName || (linkedUser ? linkedUser.firstName : '');
                        recipientDetails.lastName = recipientDetails.lastName || (linkedUser ? linkedUser.lastName : '');
                    }
                    // Ensure businessName is explicitly set for the frontend
                    recipientDetails.businessName = recipientDetails.businessName || '';
                }
                msgObj.recipientId = recipientDetails || {};
            } else {
                msgObj.recipientId = {};
            }
            return msgObj;
        }));

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

        // Find the conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Ensure the current user is a participant in this conversation
        const isParticipant = conversation.participants.some(pId => pId.toString() === currentUserId.toString());
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not authorized to mark messages in this conversation as read' });
        }

        // Mark all messages in this conversation as read for the current user (as recipient)
        await Message.updateMany(
            {
                conversationId: conversationId,
                recipientId: currentUserId, // Only mark messages where current user is the recipient
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


        // The conversation participants array should always store User _ids
        const conversationUserIds = [participant1Details.linkedUser._id, participant2Details.linkedUser._id].map(id => id.toString()).sort();
        
        // The participantModels array should correspond to the sorted conversationUserIds
        // We need to ensure the order of participantModels matches the sorted conversationUserIds
        const sortedParticipantModels = [];
        if (conversationUserIds[0] === participant1Details.linkedUser._id.toString()) {
            sortedParticipantModels.push(participant1Details.model);
            sortedParticipantModels.push(participant2Details.model);
        } else {
            sortedParticipantModels.push(participant2Details.model);
            sortedParticipantModels.push(participant1Details.model);
        }

        console.log(`Backend: find-or-create-conversation: Conversation User IDs (sorted):`, conversationUserIds);
        console.log(`Backend: find-or-create-conversation: Sorted Participant Models:`, sortedParticipantModels);

        let conversation = await Conversation.findOneAndUpdate(
            {
                participants: { $all: conversationUserIds }
            },
            {
                $setOnInsert: {
                    participants: conversationUserIds,
                    participantModels: sortedParticipantModels
                },
                $set: { lastMessageAt: new Date() } // Update last message timestamp
            },
            { upsert: true, new: true }
        );

        // Return full participant details for the frontend to use
        const participantsWithDetails = [];
        for (const pId of conversationUserIds) {
            const participantModelType = sortedParticipantModels[conversationUserIds.indexOf(pId)];
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