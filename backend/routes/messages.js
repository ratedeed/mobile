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
 
 
        const message = new Message({
            senderId: actualSenderId,
            senderOnModel,
            recipientId: actualRecipientId,
            recipientOnModel,
            messageText,
        });
 
        const createdMessage = await message.save();
 
        // Populate recipientId before sending back to frontend
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
            }).exec();
 
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
 
        let idsToMatch = [currentUserId]; // Always include the user's own ID
 
        // If the current user is a contractor, also include their Contractor profile ID
        if (currentUserRole === 'contractor') {
            const contractorProfile = await Contractor.findOne({ user: currentUserId }).select('_id');
            if (contractorProfile) {
                idsToMatch.push(contractorProfile._id);
            }
        }
 
        const pipeline = [
            {
                $match: {
                    $or: [
                        { senderId: { $in: idsToMatch } },
                        { recipientId: { $in: idsToMatch } }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 } // Sort by most recent message first
            },
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $in: ["$senderId", idsToMatch] },
                            then: "$recipientId",
                            else: "$senderId"
                        }
                    },
                    lastMessage: { $first: "$$ROOT" }, // Get the entire last message document
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $in: ["$recipientId", idsToMatch] }, { $eq: ["$read", false] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users', // Collection name for User model
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userParticipant'
                }
            },
            {
                $lookup: {
                    from: 'contractors', // Collection name for Contractor model
                    localField: '_id',
                    foreignField: '_id',
                    as: 'contractorParticipant'
                }
            },
            {
                $addFields: {
                    otherParticipant: {
                        $cond: {
                            if: { $ne: ["$userParticipant", []] },
                            then: { $arrayElemAt: ["$userParticipant", 0] },
                            else: { $arrayElemAt: ["$contractorParticipant", 0] }
                        }
                    }
                }
            },
            {
                $match: {
                    otherParticipant: { $ne: null } // Filter out conversations where otherParticipant was not found
                }
            },
            {
                $project: {
                    _id: 0, // Exclude the _id from the grouped result
                    lastMessage: 1,
                    unreadCount: 1,
                    otherParticipant: {
                        _id: "$otherParticipant._id",
                        firstName: "$otherParticipant.firstName",
                        lastName: "$otherParticipant.lastName",
                        companyName: "$otherParticipant.companyName",
                        profilePicture: "$otherParticipant.profilePicture",
                        role: { // Determine role based on which lookup was successful
                            $cond: {
                                if: { $ne: ["$userParticipant", []] },
                                then: "User",
                                else: "Contractor"
                            }
                        }
                    }
                }
            }
        ];
 
        const conversations = await Message.aggregate(pipeline);
 
        // Add current user to participants array for each conversation (frontend expects this structure)
        let currentUserPopulated;
        if (currentUserRole === 'contractor') {
            currentUserPopulated = await Contractor.findOne({ user: currentUserId }).select('firstName lastName companyName profilePicture');
            console.log('Backend: Populated Contractor (currentUserPopulated):', currentUserPopulated);
        } else {
            currentUserPopulated = await User.findById(currentUserId).select('firstName lastName profilePicture');
            console.log('Backend: Populated User (currentUserPopulated):', currentUserPopulated);
        }
 
        console.log('Backend: Current user populated (after conditional):', currentUserPopulated);
 
        const finalConversations = conversations.map(conv => {
            const participants = [conv.otherParticipant];
            if (currentUserPopulated && participants.every(p => p._id.toString() !== currentUserPopulated._id.toString())) {
                participants.push({
                    _id: currentUserPopulated._id,
                    firstName: currentUserPopulated.firstName,
                    lastName: currentUserPopulated.lastName,
                    companyName: currentUserPopulated.companyName,
                    profilePicture: currentUserPopulated.profilePicture,
                    role: currentUserRole // Add current user's role
                });
            }
            return {
                ...conv,
                participants: participants
            };
        });

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
        const currentUserId = req.user._id;
        const currentUserRole = req.user.role;
        const otherUserId = req.params.otherUserId;
 
        let currentUserIdForQuery = currentUserId;
        if (currentUserRole === 'contractor') {
            const contractorProfile = await Contractor.findOne({ user: currentUserId }).select('_id');
            if (contractorProfile) {
                currentUserIdForQuery = contractorProfile._id;
            }
        }
 
        let otherUserIdForQuery = otherUserId;
        // Determine if otherUserId is a User or Contractor ID
        let otherUserIsUser = await User.findById(otherUserId);
        let otherUserIsContractor = null;
        if (!otherUserIsUser) {
            otherUserIsContractor = await Contractor.findById(otherUserId);
        }
 
        if (otherUserIsContractor) {
            otherUserIdForQuery = otherUserIsContractor._id;
        } else if (otherUserIsUser) {
            otherUserIdForQuery = otherUserIsUser._id;
        } else {
            return res.status(404).json({ message: 'Other participant not found' });
        }
 
 
        const query = {
            $or: [
                { $and: [{ senderId: currentUserIdForQuery }, { recipientId: otherUserIdForQuery }] },
                { $and: [{ senderId: otherUserIdForQuery }, { recipientId: currentUserIdForQuery }] }
            ]
        };
 
        const messages = await Message.find(query)
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
            if (msg.recipientId && msg.recipientId._id && msg.recipientId._id.toString() === currentUserIdForQuery.toString() && !msg.read) {
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
        if (message.recipientId.toString() !== req.user._id.toString()) {
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

module.exports = router;