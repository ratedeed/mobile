import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  createConversation, // Import createConversation
  registerSocket,
  joinConversationSocket,
  leaveConversationSocket,
  onNewMessage,
  onMessageRead,
  onTyping,
  onUserOnlineStatus,
  emitTyping,
  emitMessageRead,
} from '../api/messages'; // Import all socket-related functions
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/common/Header';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import { useRoute, useNavigation } from '@react-navigation/native';
// API_BASE_URL is now used internally by src/api/messages.js, no need to import here

const getParticipantDisplayName = (entity, currentUserId) => { // Pass currentUserId to identify 'other' participant
  console.log('DEBUG: getParticipantDisplayName - Received entity:', JSON.stringify(entity));
  if (!entity) {
    console.log('DEBUG: getParticipantDisplayName - Entity is null/undefined, returning "Unknown".');
    return 'Unknown';
  }

  // Try to get name from direct properties (for participant objects)
  if (entity.businessName) {
    console.log('DEBUG: getParticipantDisplayName - Found businessName directly:', entity.businessName);
    return entity.businessName;
  }
  if (entity.companyName) {
    console.log('DEBUG: getParticipantDisplayName - Found companyName directly:', entity.companyName);
    return entity.companyName;
  }
  const nameFromFirstLast = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
  if (nameFromFirstLast) {
    console.log('DEBUG: getParticipantDisplayName - Found firstName/lastName directly:', nameFromFirstLast);
    return nameFromFirstLast;
  }
  if (entity.name && entity.name !== 'Unknown') {
    console.log('DEBUG: getParticipantDisplayName - Found generic name directly:', entity.name);
    return entity.name;
  }

  // If entity is a conversation object, try to find the other participant within it
  if (entity.participants && Array.isArray(entity.participants) && currentUserId) {
    const otherParticipantInConvo = entity.participants.find(p => p._id && p._id.toString() !== currentUserId.toString());
    if (otherParticipantInConvo) {
      console.log('DEBUG: getParticipantDisplayName - Found otherParticipant in conversation.participants:', JSON.stringify(otherParticipantInConvo));
      // Recursively call to get display name from the found participant
      const nameFromNestedParticipant = getParticipantDisplayName(otherParticipantInConvo);
      if (nameFromNestedParticipant && nameFromNestedParticipant !== 'Unknown') {
        return nameFromNestedParticipant;
      }
    }
  }

  // If entity has an otherParticipant property (e.g., selectedConversation.otherParticipant)
  if (entity.otherParticipant) {
    console.log('DEBUG: getParticipantDisplayName - Found otherParticipant property:', JSON.stringify(entity.otherParticipant));
    const nameFromOtherParticipantProp = getParticipantDisplayName(entity.otherParticipant);
    if (nameFromOtherParticipantProp && nameFromOtherParticipantProp !== 'Unknown') {
      return nameFromOtherParticipantProp;
    }
  }

  // Fallback to role-based names if available on the entity itself
  if (entity.role && entity.role.toLowerCase() === 'contractor') {
    console.log('DEBUG: getParticipantDisplayName - Entity is contractor, but no specific name. Falling back to "Unknown Contractor".');
    return 'Unknown Contractor';
  }
  if (entity.role && entity.role.toLowerCase() === 'user') {
    console.log('DEBUG: getParticipantDisplayName - Entity is user, but no specific name. Falling back to "Unknown User".');
    return 'Unknown User';
  }

  // Final fallback
  console.log('DEBUG: getParticipantDisplayName - No identifiable name found in any field. Returning "Unknown". Final entity state:', JSON.stringify(entity));
  return 'Unknown';
};

const MessagesScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { recipientId, recipientName } = route.params || {};
  console.log('DEBUG: MessagesScreen (initial render) - route.params:', JSON.stringify(route.params));
  console.log('DEBUG: MessagesScreen (initial render) - recipientId:', recipientId);
  console.log('DEBUG: MessagesScreen (initial render) - recipientName:', recipientName);
  console.log('DEBUG: MessagesScreen (initial render) - route.name:', route.name);
  console.log('DEBUG: MessagesScreen (initial render) - Type of recipientName:', typeof recipientName);
 
  const [conversations, setConversations] = useState({}); // Change to an object keyed by conversationId
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesScrollViewRef = useRef(); // Create a ref for the messages ScrollView
  const selectedConversationRef = useRef(selectedConversation); // Ref to hold the latest selectedConversation
 
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { conversationId: { userId: true/false } }
  const [onlineUsers, setOnlineUsers] = useState({}); // { userId: true/false }

  // Helper functions for AsyncStorage (moved to top for better organization)
  const saveConversationsToStorage = async (convs) => {
    try {
      await AsyncStorage.setItem('conversations', JSON.stringify(convs));
      console.log('Conversations saved to AsyncStorage.');
    } catch (error) {
      console.error('Error saving conversations to AsyncStorage:', error);
    }
  };

  const loadConversationsFromStorage = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('conversations');
      const loadedConversations = jsonValue != null ? JSON.parse(jsonValue) : null;
      console.log('Conversations loaded from AsyncStorage:', loadedConversations ? Object.keys(loadedConversations).length : 0, 'conversations');
      return loadedConversations;
    } catch (error) {
      console.error('Error loading conversations from AsyncStorage:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          const decodedToken = jwtDecode(token);
          setCurrentUserId(decodedToken.id); // Assuming the user ID is in the 'id' field of the token
          console.log('Fetched CURRENT_USER_ID from token:', decodedToken.id);
        } else {
          console.warn('No user token found in AsyncStorage.');
        }
      } catch (error) {
        console.error('Error fetching user ID from token:', error);
      }
    };
    fetchUserId();
  }, []); // Run once on component mount

  // Update the ref whenever selectedConversation changes
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Use a separate useEffect for handling initial load based on recipientId
  useEffect(() => {
    const initializeSpecificChat = async () => {
      if (route.name === 'ChatScreen' && recipientId && currentUserId) { // Add currentUserId dependency
        setLoading(true);
        console.log('DEBUG: initializeSpecificChat - recipientId:', recipientId);
        console.log('DEBUG: initializeSpecificChat - recipientName (from route.params):', recipientName); // Added log
        try {
          const fetchedConversations = await fetchConversations();
          console.log('DEBUG: initializeSpecificChat - fetchedConversations (raw):', JSON.stringify(fetchedConversations, null, 2));
          // Convert array to object keyed by conversationId and ensure _id is set
          const conversationsMap = fetchedConversations.reduce((acc, conv) => {
            acc[conv.conversationId] = { ...conv, _id: conv.conversationId }; // Use conversationId as _id
            return acc;
          }, {});
          setConversations(conversationsMap); // Set the conversations map

          const foundConversation = Object.values(conversationsMap).find(conv => {
            // For existing conversations, check if the recipientId matches any participant's _id
            return conv.participants.some(p => p._id === recipientId);
          });
          console.log('DEBUG: initializeSpecificChat - foundConversation:', JSON.stringify(foundConversation, null, 2));

          if (foundConversation) {
            setSelectedConversation(foundConversation);
            await loadMessages(foundConversation.conversationId); // Load messages using conversationId
          } else {
            // If no existing conversation, create a temporary one for display
            const newMockConversation = {
              _id: `temp-${recipientId}`, // Temporary ID for new conversations
              conversationId: `temp-${recipientId}`, // Also set conversationId for consistency
              name: recipientName, // Use recipientName for initial display
              businessName: recipientName, // Add businessName to the top level of newMockConversation
              companyName: recipientName, // Add companyName to the top level of newMockConversation
              participants: [
                { _id: currentUserId, role: 'User' }, // Assuming current user is always a User
                { _id: recipientId, name: recipientName, role: 'Contractor' } // Explicitly set role to Contractor for new chats
              ],
              otherParticipant: {
                _id: recipientId,
                name: recipientName, // Use recipientName for display
                role: 'Contractor', // Explicitly set role to Contractor for new chats
                businessName: recipientName, // Assume recipientName is the businessName for new contractor chats
                companyName: recipientName, // Also set companyName for robustness
              },
              messages: [],
            };
            console.log('DEBUG: initializeSpecificChat - newMockConversation.otherParticipant before setting selectedConversation:', JSON.stringify(newMockConversation.otherParticipant, null, 2)); // Added log
            setSelectedConversation(newMockConversation);
            setMessages([]);
            console.log('DEBUG: initializeSpecificChat - Created newMockConversation:', JSON.stringify(newMockConversation, null, 2));
          }
        } catch (error) {
          Alert.alert('Error', error.message || 'Failed to initialize specific chat.');
          console.error('DEBUG: Initialize specific chat error:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    initializeSpecificChat();
  }, [route.name, recipientId, currentUserId, navigation]);

  // Use another useEffect to handle tab focus for loading all conversations
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('MessagesScreen: Focus event detected. Current route name:', route.name);
      if (route.name === 'Messages' && currentUserId) { // Add currentUserId dependency
        console.log('MessagesScreen: Tab focused - loading all conversations.');
        loadConversations();
        setSelectedConversation(null); // Ensure conversation list is shown
      }
    });

    return unsubscribe; // Cleanup the listener
  }, [navigation, route.name, currentUserId]); // Add currentUserId to dependencies

  // Effect to load messages when a conversation is selected
  useEffect(() => {
    console.log('DEBUG: selectedConversation useEffect - selectedConversation changed:', JSON.stringify(selectedConversation, null, 2));
    if (selectedConversation?.conversationId && currentUserId) { // Use optional chaining for selectedConversation
      // If it's a temporary conversation (new chat), don't load messages yet
      if (selectedConversation.conversationId?.startsWith('temp-')) { // Use optional chaining for conversationId
        setMessages([]);
        console.log('DEBUG: selectedConversation useEffect - Temporary conversation, not loading messages.');
      } else {
        loadMessages(selectedConversation.conversationId); // Load messages using conversationId
        console.log('DEBUG: selectedConversation useEffect - Loading messages for conversation:', selectedConversation.conversationId);
      }
    }
  }, [selectedConversation, currentUserId]); // Add currentUserId to dependencies

  // Effect to scroll to the bottom of the messages list when new messages arrive
  useEffect(() => {
    if (messagesScrollViewRef.current) {
      messagesScrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]); // Dependency on messages array

  // Socket.IO setup and event handlers
  useEffect(() => {
    if (!currentUserId) return;

    registerSocket(currentUserId);

    const handleNewMessage = (message) => {
      console.log('--- SOCKET EVENT: newMessage received ---');
      console.log('DEBUG: handleNewMessage - Full message object:', JSON.stringify(message, null, 2));
      console.log('DEBUG: handleNewMessage - currentUserId (from state):', currentUserId);
      console.log('DEBUG: handleNewMessage - selectedConversationRef.current:', JSON.stringify(selectedConversationRef.current, null, 2));

      const senderId = message.senderId?._id;
      const recipientId = message.recipientId?._id;

      if (!senderId || !recipientId) {
        console.warn('DEBUG: handleNewMessage - Missing senderId or recipientId in message:', message);
        return;
      }

      const currentSelectedConversation = selectedConversationRef.current;

      setConversations((prevConversations) => {
        const convo = prevConversations[message.conversationId] || {
          _id: message.conversationId,
          participants: [],
          messages: [],
          lastMessage: null,
          unreadCount: 0,
          otherParticipant: null,
        };

        let otherParticipant = convo.otherParticipant;
        // If otherParticipant is not fully populated, try to populate it from the message sender/recipient
        if (!otherParticipant || !otherParticipant.name || otherParticipant.name === 'Unknown' || !otherParticipant.role) { // Add !otherParticipant.role check
          const rawOtherParticipant = message.senderId._id === currentUserId
            ? message.recipientId
            : message.senderId;
          console.log('DEBUG: handleNewMessage - rawOtherParticipant (for populating otherParticipant):', JSON.stringify(rawOtherParticipant));

          let displayName = 'Unknown';
          let firstName = '';
          let lastName = '';
          let businessName = ''; // Changed companyName to businessName
          let profilePicture = '';
          let role = rawOtherParticipant.role || 'User'; // Ensure role is always set

          if (role.toLowerCase() === 'user') { // Use toLowerCase for robustness
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
            displayName = `${firstName} ${lastName}`.trim();
            if (!displayName) displayName = 'Unknown User';
            profilePicture = rawOtherParticipant.profilePicture || '';
          } else if (role.toLowerCase() === 'contractor') { // Use toLowerCase for robustness
            businessName = rawOtherParticipant.businessName || rawOtherParticipant.companyName || ''; // Prioritize businessName, fallback to companyName
            displayName = businessName;
            if (!displayName) displayName = 'Unknown Contractor';
            profilePicture = rawOtherParticipant.profilePicture || '';
            // For contractors, also try to get firstName/lastName from the linked user if available
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
          }

          otherParticipant = {
            _id: rawOtherParticipant._id,
            firstName: firstName,
            lastName: lastName,
            businessName: businessName, // Store as businessName
            profilePicture: profilePicture,
            role: role, // Ensure role is explicitly set
            name: displayName, // Set the display name here
          };
          console.log('DEBUG: handleNewMessage - Constructed otherParticipant:', JSON.stringify(otherParticipant));
        }

        const updatedMessages = [...convo.messages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const isFromOtherParticipant = message.senderId._id !== currentUserId;
        const isConversationSelected = currentSelectedConversation && currentSelectedConversation._id === message.conversationId;
        const newUnreadCount = convo.unreadCount + (isFromOtherParticipant && !isConversationSelected ? 1 : 0);

        return {
          ...prevConversations,
          [message.conversationId]: {
            ...convo,
            messages: updatedMessages,
            lastMessage: message,
            unreadCount: newUnreadCount,
            otherParticipant: otherParticipant,
          },
        };
      });

      const isMessageForCurrentChat = currentSelectedConversation && currentSelectedConversation._id === message.conversationId;
      if (isMessageForCurrentChat) {
        setMessages((prevMessages) => {
          const updatedMsgs = [...prevMessages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return updatedMsgs;
        });
        // Mark message as read if it's for the current conversation and from the other participant
        if (message.recipientId._id === currentUserId && !message.read) {
          emitMessageRead(message._id, currentUserId);
        }
      }
    };

    const handleMessageRead = ({ messageId, conversationId, readerId }) => {
      console.log(`--- SOCKET EVENT: messageRead received --- Message ${messageId} in conversation ${conversationId} read by ${readerId}`);
      setConversations(prevConversations => {
        const updatedConvos = { ...prevConversations };
        if (updatedConvos[conversationId]) {
          // Find the message and mark it as read in the local state
          const updatedMessages = updatedConvos[conversationId].messages.map(msg =>
            msg._id === messageId ? { ...msg, read: true } : msg
          );
          updatedConvos[conversationId] = {
            ...updatedConvos[conversationId],
            messages: updatedMessages,
            // Optionally update lastMessage read status if it's the one being read
            lastMessage: updatedConvos[conversationId].lastMessage?._id === messageId
              ? { ...updatedConvos[conversationId].lastMessage, read: true }
              : updatedConvos[conversationId].lastMessage,
          };
        }
        return updatedConvos;
      });
      setMessages(prevMessages => prevMessages.map(msg =>
        msg._id === messageId ? { ...msg, read: true } : msg
      ));
    };

    const handleTyping = ({ userId, isTyping }) => {
      console.log(`--- SOCKET EVENT: typing received --- User ${userId} is ${isTyping ? 'typing' : 'not typing'}`);
      setTypingUsers(prev => ({
        ...prev,
        [selectedConversationRef.current?.conversationId]: { // Use conversationId here
          ...prev[selectedConversationRef.current?.conversationId], // Use conversationId here
          [userId]: isTyping
        }
      }));
    };

    const handleUserOnlineStatus = ({ userId, isOnline }) => {
      console.log(`--- SOCKET EVENT: userOnlineStatus received --- User ${userId} is ${isOnline ? 'online' : 'offline'}`);
      setOnlineUsers(prev => ({
        ...prev,
        [userId]: isOnline
      }));
    };

    onNewMessage(handleNewMessage);
    onMessageRead(handleMessageRead);
    onTyping(handleTyping);
    onUserOnlineStatus(handleUserOnlineStatus);

    return () => {
      // Clean up listeners when component unmounts or currentUserId changes
      onNewMessage(() => {}); // Remove all listeners by passing empty function
      onMessageRead(() => {});
      onTyping(() => {});
      onUserOnlineStatus(() => {});
      leaveConversationSocket(selectedConversationRef.current?._id); // Leave current conversation room
    };
  }, [currentUserId]);

  // Effect to join/leave conversation rooms
  useEffect(() => {
    if (selectedConversation?.conversationId && currentUserId) { // Use optional chaining
      if (!selectedConversation.conversationId?.startsWith('temp-')) { // Use optional chaining
        joinConversationSocket(selectedConversation.conversationId); // Use conversationId
        // Mark all messages in the selected conversation as read when opened
        setConversations(prev => {
          const updatedConvos = { ...prev };
          if (updatedConvos[selectedConversation.conversationId]) { // Use conversationId
            updatedConvos[selectedConversation.conversationId] = { // Use conversationId
              ...updatedConvos[selectedConversation.conversationId], // Use conversationId
              unreadCount: 0,
            };
          }
          return updatedConvos;
        });
        // Also mark messages as read on the backend
        messages.forEach(msg => {
          if (msg.recipientId && msg.recipientId._id.toString() === currentUserId && !msg.read) {
            emitMessageRead(msg._id, currentUserId);
          }
        });
      }
    }
    // Cleanup: leave the conversation room when component unmounts or conversation changes
    return () => {
      if (selectedConversation?.conversationId && !selectedConversation.conversationId?.startsWith('temp-')) { // Use optional chaining
        leaveConversationSocket(selectedConversation.conversationId); // Use conversationId
      }
    };
  }, [selectedConversation, currentUserId, messages]); // Added messages as dependency for marking read

  const loadConversations = async () => {
    setLoading(true);
    console.log('DEBUG: loadConversations - currentUserId at start:', currentUserId);
    try {
      const fetchedConversations = await fetchConversations();
      console.log('DEBUG: loadConversations - Raw data fetched from API:', JSON.stringify(fetchedConversations, null, 2));

      // Load conversations from AsyncStorage first
      let conversationsMap = await loadConversationsFromStorage() || {};

      // Fetch latest conversations from API
      const apiFetchedConversations = await fetchConversations();
      console.log('DEBUG: loadConversations - Raw data fetched from API (second fetch, for comparison):', JSON.stringify(apiFetchedConversations, null, 2));

      // Merge API fetched conversations with stored ones, prioritizing API data for existing conversations
      // and adding new ones. Ensure _id is set to conversationId.
      apiFetchedConversations.forEach(conv => {
        conversationsMap[conv.conversationId] = {
          ...conversationsMap[conv.conversationId], // Keep existing client-side state if any
          ...conv, // Overwrite with fresh server data
          _id: conv.conversationId, // Ensure _id is set for consistency
          messages: [], // Always initialize messages as empty, they will be loaded on selection
          fragmentConversationIds: conversationsMap[conv.conversationId]?.fragmentConversationIds || [], // Preserve fragment IDs if already present
        };
        // Ensure otherParticipant is correctly populated from the fetched conversation
        const other = conv.participants.find(p => {
          console.log(`DEBUG: loadConversations - Checking participant p._id: ${p._id}, currentUserId: ${currentUserId}`);
          return p._id && currentUserId && p._id.toString() !== currentUserId.toString();
        });
        if (other) {
          // Construct otherParticipant with all necessary fields, including role and businessName/companyName
          const otherParticipantDetails = {
            _id: other._id,
            firstName: other.firstName || '',
            lastName: other.lastName || '',
            businessName: other.businessName || '',
            companyName: other.companyName || '',
            profilePicture: other.profilePicture || '',
            // Determine role: if businessName or companyName exists, assume 'Contractor', else use existing role or default to 'User'
            role: (other.businessName || other.companyName) ? 'Contractor' : (other.role || 'User'),
          };
          console.log('DEBUG: loadConversations - otherParticipantDetails before getParticipantDisplayName:', JSON.stringify(otherParticipantDetails)); // Added log
          otherParticipantDetails.name = getParticipantDisplayName(otherParticipantDetails, currentUserId); // Pass currentUserId
          conversationsMap[conv.conversationId].otherParticipant = otherParticipantDetails;
          console.log('DEBUG: loadConversations - Constructed otherParticipant for conversation:', JSON.stringify(otherParticipantDetails));
        }
      });

      // Remove conversations from map that are no longer returned by the API
      for (const convId in conversationsMap) {
        if (!apiFetchedConversations.some(fc => fc.conversationId === convId)) {
          delete conversationsMap[convId];
        }
      }

      console.log('DEBUG: loadConversations - conversationsMap after initial fetch and merge with stored:', JSON.stringify(conversationsMap, null, 2));

      // Retroactive Merge of Fragments (Step 4)
      const groups = Object.values(conversationsMap).reduce((acc, convo) => {
        const other = convo.participants.find(p => {
          console.log(`DEBUG: loadConversations - Grouping participant p._id: ${p._id}, currentUserId: ${currentUserId}`);
          return p._id && currentUserId && p._id.toString() !== currentUserId.toString();
        });
        if (other) {
          const otherId = other._id.toString();
          acc[otherId] = acc[otherId] || [];
          acc[otherId].push(convo);
        }
        return acc;
      }, {});
      console.log('DEBUG: loadConversations - groups after fragment grouping:', JSON.stringify(groups, null, 2));

      Object.entries(groups).forEach(([otherId, convos]) => {
        if (convos.length > 1) {
          console.log(`DEBUG: Merging fragments for otherId: ${otherId}`);
          // Choose canonical (e.g., highest message count or earliest createdAt)
          const canonical = convos.reduce((keep, c) =>
            new Date(c.lastMessage?.createdAt || 0) < new Date(keep.lastMessage?.createdAt || 0) ? c : keep
          );

          // Collect IDs of non-canonical conversations to be merged
          const fragmentIds = convos
            .filter(c => c.conversationId !== canonical.conversationId) // Use conversationId
            .map(c => c.conversationId); // Use conversationId

          // Update the canonical conversation in the map
          conversationsMap[canonical.conversationId] = { // Use conversationId
            ...canonical,
            fragmentConversationIds: [...(canonical.fragmentConversationIds || []), ...fragmentIds], // Store fragment IDs
            // lastMessage and unreadCount will be updated by the socket or when messages are loaded
            messages: [], // Messages will be loaded when conversation is selected
          };

          // Remove non-canonical conversations from the map
          fragmentIds.forEach(id => {
            delete conversationsMap[id];
          });
        }
      });

      setConversations(conversationsMap);
      await saveConversationsToStorage(conversationsMap); // Persist the cleaned state
      console.log('DEBUG: loadConversations - conversations state set to (after merge and persist):', JSON.stringify(conversationsMap, null, 2));
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load conversations.');
      console.error('DEBUG: Load conversations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    setLoading(true);
    try {
      // Fetch messages for the given conversationId
      const fetchedMessages = await fetchMessages(conversationId);
      const sortedMessages = fetchedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(sortedMessages);
      console.log(`loadMessages: Fetched and sorted ${sortedMessages.length} messages for conversation ${conversationId}`);

      // Update the conversation in the main conversations state to reset unread count
      setConversations(prev => {
        const updatedConvos = { ...prev };
        if (updatedConvos[conversationId]) {
          updatedConvos[conversationId] = {
            ...updatedConvos[conversationId],
            messages: sortedMessages, // Update messages in conversation object
            unreadCount: 0, // Mark all messages as read when conversation is opened
          };
        }
        saveConversationsToStorage(updatedConvos); // Persist the updated state
        return updatedConvos;
      });

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load messages.');
      console.error('Load messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUserId) {
      return;
    }

    try {
      let finalConversationId = selectedConversation.conversationId; // Use conversationId
      let targetRecipientId;

      if (selectedConversation.conversationId?.startsWith('temp-')) { // Use optional chaining
        // For a new conversation, the recipientId from route.params is the targetRecipientId
        console.log('DEBUG: handleSendMessage - Finding or creating new conversation...');
        const { conversationId: newConvoId, participants: newConvoParticipants } = await createConversation([currentUserId, recipientId]);
        finalConversationId = newConvoId;
        
        // Find the other participant from the newly created conversation's participants
        const rawActualOtherParticipant = newConvoParticipants.find(p => p._id && p._id.toString() !== currentUserId.toString());
        console.log('DEBUG: handleSendMessage - rawActualOtherParticipant from createConversation:', JSON.stringify(rawActualOtherParticipant, null, 2));

        // Construct the full otherParticipant object, similar to loadConversations
        let processedOtherParticipant = {
          _id: rawActualOtherParticipant._id,
          firstName: rawActualOtherParticipant.firstName || '',
          lastName: rawActualOtherParticipant.lastName || '',
          businessName: rawActualOtherParticipant.businessName || rawActualOtherParticipant.companyName || '', // Prioritize businessName, fallback to companyName
          profilePicture: rawActualOtherParticipant.profilePicture || '',
          role: (rawActualOtherParticipant.businessName || rawActualOtherParticipant.companyName) ? 'Contractor' : (rawActualOtherParticipant.role || 'User'),
        };
        processedOtherParticipant.name = getParticipantDisplayName(processedOtherParticipant, currentUserId); // Pass currentUserId
        console.log('DEBUG: handleSendMessage - processedOtherParticipant before setting selectedConversation:', JSON.stringify(processedOtherParticipant, null, 2));
        
        // Update the selected conversation with the real ID and participants
        setSelectedConversation(prev => {
          const updatedSelected = {
            ...prev,
            _id: newConvoId, // Update _id
            conversationId: newConvoId, // Update conversationId
            otherParticipant: processedOtherParticipant, // Use the processed object
            participants: newConvoParticipants,
          };
          console.log('DEBUG: handleSendMessage - Updated selectedConversation after createConversation:', JSON.stringify(updatedSelected, null, 2));
          return updatedSelected;
        });

        // Add the new conversation to the conversations map with full info
        setConversations(prev => {
          const updatedConversationsMap = {
            ...prev,
            [newConvoId]: { // Use newConvoId
              _id: newConvoId, // Ensure _id is set
              conversationId: newConvoId, // Ensure conversationId is set
              participants: newConvoParticipants,
              otherParticipant: processedOtherParticipant, // Directly use the full participant object from backend
              messages: [],
              lastMessage: null,
              unreadCount: 0,
            }
          };
          console.log('DEBUG: handleSendMessage - Added new conversation to conversations map:', JSON.stringify(updatedConversationsMap[newConvoId], null, 2));
          return updatedConversationsMap;
        });
        joinConversationSocket(finalConversationId); // Join the new conversation room
        targetRecipientId = processedOtherParticipant._id; // Set targetRecipientId from the actual participant
      } else {
        // For existing conversations, find the other participant from the participants array
        const otherParticipant = selectedConversation.participants.find(
          p => p._id && p._id.toString() !== currentUserId.toString()
        );
        targetRecipientId = otherParticipant?._id;
        console.log('DEBUG: handleSendMessage - Existing conversation, otherParticipant:', JSON.stringify(otherParticipant));
      }

      if (!targetRecipientId) {
        console.error('DEBUG: handleSendMessage - targetRecipientId is undefined. Cannot send message.');
        Alert.alert('Error', 'Could not determine recipient for message.');
        return;
      }

      console.log('DEBUG: handleSendMessage - Determined targetRecipientId:', targetRecipientId);

      // Send the message using the determined conversationId and recipientId
      const sentMessage = await sendMessage(finalConversationId, targetRecipientId, newMessage);
      setNewMessage('');
      emitTyping(finalConversationId, currentUserId, false); // Stop typing after sending
      console.log('DEBUG: handleSendMessage - Message sent:', JSON.stringify(sentMessage, null, 2));

      // Update the messages for the currently selected conversation
      setConversations(prev => {
        const currentConvo = prev[sentMessage.conversationId] || {
          _id: sentMessage.conversationId,
          conversationId: sentMessage.conversationId, // Ensure conversationId is set
          participants: [],
          messages: [],
          lastMessage: null,
          unreadCount: 0,
          otherParticipant: null,
        };

        let otherParticipant = currentConvo.otherParticipant;
        // If otherParticipant is not fully populated, try to populate it from the message sender/recipient
        // This block is now less critical as createConversation should provide full details,
        // but kept as a fallback for messages received via socket for existing conversations.
        if (!otherParticipant || !otherParticipant.name || otherParticipant.name === 'Unknown' || (!otherParticipant.businessName && otherParticipant.role === 'Contractor')) {
          const rawOtherParticipant = sentMessage.senderId._id === currentUserId
            ? sentMessage.recipientId
            : sentMessage.senderId;
          console.log('DEBUG: handleSendMessage - rawOtherParticipant (for updating otherParticipant in conversations map):', JSON.stringify(rawOtherParticipant));

          let displayName = 'Unknown';
          let firstName = '';
          let lastName = '';
          let businessName = ''; // Changed companyName to businessName
          let profilePicture = '';
          let role = rawOtherParticipant.role || 'User';

          if (rawOtherParticipant.role === 'User') {
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
            displayName = `${firstName} ${lastName}`.trim();
            if (!displayName) displayName = 'Unknown User';
            profilePicture = rawOtherParticipant.profilePicture || '';
          } else if (rawOtherParticipant.role === 'Contractor') {
            businessName = rawOtherParticipant.businessName || ''; // Use businessName
            displayName = businessName;
            if (!displayName) displayName = 'Unknown Contractor';
            profilePicture = rawOtherParticipant.profilePicture || '';
            // For contractors, also try to get firstName/lastName from the linked user if available
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
          }

          otherParticipant = {
            _id: rawOtherParticipant._id,
            firstName: firstName,
            lastName: lastName,
            businessName: businessName, // Store as businessName
            profilePicture: profilePicture,
            role: role, // Ensure role is explicitly set
            name: displayName, // Set the display name here
          };
          console.log('DEBUG: handleSendMessage - Constructed otherParticipant for conversations map update:', JSON.stringify(otherParticipant));
        }

        const updatedMessages = [...currentConvo.messages, sentMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        return {
          ...prev,
          [sentMessage.conversationId]: {
            ...currentConvo,
            messages: updatedMessages,
            lastMessage: sentMessage,
            otherParticipant: otherParticipant,
            unreadCount: 0,
          },
        };
      });

      setMessages((prevMessages) => [...prevMessages, sentMessage]);

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send message.');
      console.error('DEBUG: Send message error:', error);
    }
  };

  const handleTypingChange = (text) => {
    setNewMessage(text);
    if (selectedConversation && currentUserId) {
      const newIsTyping = text.length > 0;
      if (newIsTyping !== isTyping) {
        emitTyping(selectedConversation._id, currentUserId, newIsTyping);
        setIsTyping(newIsTyping);
      }
    }
  };

  const formatMessageTime = (timestamp) => {
    const messageDate = new Date(timestamp);
    const now = new Date();

    // Normalize dates to compare just the day, month, and year
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const msgDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

    if (msgDay.getTime() === today.getTime()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (msgDay.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else if (now.getFullYear() === messageDate.getFullYear()) {
      // Same year, show month and day
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      // Different year, show full date
      return messageDate.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary500} />
        <Typography variant="body" style={styles.loadingText}>Loading messages...</Typography>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fullScreenContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Header is always present */}
        <Header
          title={(() => {
            if (!selectedConversation) {
              console.log('DEBUG: MessagesScreen - Header title: No conversation selected, showing "Conversations".');
              return 'Conversations';
            }
            console.log('DEBUG: MessagesScreen - selectedConversation for Header:', JSON.stringify(selectedConversation, null, 2));
            const participantForHeader = selectedConversation?.otherParticipant || selectedConversation;
            console.log('DEBUG: MessagesScreen - participantForHeader before getParticipantDisplayName:', JSON.stringify(participantForHeader, null, 2));
            const displayName = getParticipantDisplayName(participantForHeader, currentUserId); // Pass currentUserId
            console.log('DEBUG: MessagesScreen - Header title final displayName:', displayName);
            return displayName;
          })()}
          showBackButton={!!selectedConversation || route.name === 'ChatScreen'}
          onBackPress={() => {
            if (selectedConversation) {
              leaveConversationSocket(selectedConversation.conversationId); // Leave the socket room
              setSelectedConversation(null); // Go back to conversation list
            } else if (route.name === 'ChatScreen') {
              navigation.goBack(); // Go back to previous screen in stack (e.g., BusinessDetailScreen)
            }
          }}
          rightComponent={(() => {
            if (!selectedConversation) {
              console.log('DEBUG: MessagesScreen - Avatar: No conversation selected, returning null.');
              return null;
            }
            console.log('DEBUG: MessagesScreen - selectedConversation for Avatar:', JSON.stringify(selectedConversation, null, 2));
            const participantForAvatar = selectedConversation?.otherParticipant || selectedConversation;
            console.log('DEBUG: MessagesScreen - participantForAvatar before getParticipantDisplayName:', JSON.stringify(participantForAvatar, null, 2));
            const displayName = getParticipantDisplayName(participantForAvatar, currentUserId); // Pass currentUserId
            console.log('DEBUG: MessagesScreen - Avatar text final displayName:', displayName);
            return <Avatar text={displayName} size={Spacing.lg} />;
          })()}
        />

        {/* Conditional rendering for conversation list or messages list */}
        {!selectedConversation ? (
          <ScrollView style={styles.conversationList} contentContainerStyle={styles.conversationListContent}>
            {Object.values(conversations).length > 0 ?
              Object.values(conversations)
                .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0)) // Sort by last message date
                .map((conv) => {
                  console.log('DEBUG: Rendering conversation card for:', JSON.stringify(conv)); // Log each conversation object
                  if (!conv.lastMessage || !conv.otherParticipant) {
                    console.warn('DEBUG: Skipping conversation card due to missing lastMessage or otherParticipant:', JSON.stringify(conv));
                    return null; // Skip rendering if essential data is missing
                  }
                  return (
                    <Card key={conv.conversationId} style={styles.conversationCard}>
                      <TouchableOpacity
                        onPress={() => setSelectedConversation(conv)}
                        style={styles.conversationTouchable}
                      >
                        <Avatar text={getParticipantDisplayName(conv.otherParticipant, currentUserId)} size={Spacing.xxl} style={styles.conversationAvatar} />
                        <View style={styles.conversationTextContent}>
                          <Typography variant="h6" style={styles.conversationName}>{`Conversation with ${getParticipantDisplayName(conv.otherParticipant, currentUserId)}`}</Typography>
                          <Typography variant="body" style={styles.lastMessage}>{conv.lastMessage.messageText || 'No messages yet.'}</Typography>
                          {conv.unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                              <Typography variant="caption" style={styles.unreadText}>{conv.unreadCount}</Typography>
                            </View>
                          )}
                        </View>
                        <Typography variant="caption" style={styles.conversationTime}>{formatMessageTime(conv.lastMessage.createdAt)}</Typography>
                      </TouchableOpacity>
                    </Card>
                  );
                })
            : (
              <Typography variant="body" style={styles.noContentText}>No conversations yet. Start a new chat!</Typography>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            ref={messagesScrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesListContent}
            onContentSizeChange={() => messagesScrollViewRef.current.scrollToEnd({ animated: true })}
          >
            {messages.length > 0 ? (
              messages.map((msg) => {
                const isMyMessage = currentUserId && msg.senderId && msg.senderId._id === currentUserId;
                const senderDisplayName = getParticipantDisplayName(msg.senderId, currentUserId); // Pass currentUserId
                const isRead = msg.read;

                return (
                  <View
                    key={msg._id}
                    style={[
                      styles.messageBubble,
                      isMyMessage ? styles.myMessage : styles.otherMessage
                    ]}
                  >
                    {/* Removed sender name display as per user request */}
                    {/* {!isMyMessage && (
                      <Typography variant="caption" style={styles.senderName}>{senderDisplayName}</Typography>
                    )} */}
                    <Typography variant="body" style={isMyMessage ? styles.myMessageText : styles.otherMessageText}>{msg.messageText}</Typography>
                    <View style={styles.messageFooter}>
                      <Typography variant="caption" style={isMyMessage ? styles.myMessageTime : styles.otherMessageTime}>
                        {formatMessageTime(msg.createdAt)}
                      </Typography>
                      {isMyMessage && isRead && (
                        <FontAwesome5 name="check-double" size={12} color={Colors.primary100} style={styles.readIcon} />
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <Typography variant="body" style={styles.noContentText}>No messages in this conversation yet. Say hello!</Typography>
            )}
            {selectedConversation && typingUsers[selectedConversation.conversationId] && // Use conversationId here
              Object.entries(typingUsers[selectedConversation.conversationId]).map(([userId, isTypingStatus]) => { // Use conversationId here
                if (userId !== currentUserId && isTypingStatus) {
                  const typingParticipant = selectedConversation.participants.find(p => p._id === userId);
                  if (typingParticipant) {
                    return (
                      <Typography key={userId} variant="caption" style={styles.typingIndicator}>
                        {getParticipantDisplayName(typingParticipant, currentUserId)} is typing...
                      </Typography>
                    );
                  }
                }
                return null;
              })}
          </ScrollView>
        )}

        {selectedConversation && (
          <View style={styles.messageInputContainer}>
            <Input
              style={styles.messageInput}
              placeholder="Type your message..."
              placeholderTextColor={Colors.neutral500}
              value={newMessage}
              onChangeText={handleTypingChange} // Use the new handler
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
              <FontAwesome5 name="paper-plane" size={Spacing.lg} color={Colors.neutral50} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  loadingText: {
    marginTop: Spacing.sm,
    color: Colors.neutral600,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
    flexDirection: 'column', // Ensure vertical layout
  },
  subtitle: {
    color: Colors.neutral600,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  conversationList: {
    flex: 1,
    width: '100%',
  },
  conversationListContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  conversationCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  conversationTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationAvatar: {
    marginRight: Spacing.md,
  },
  conversationTextContent: {
    flex: 1,
  },
  conversationName: {
    color: Colors.neutral900,
    marginBottom: Spacing.xxs,
  },
  lastMessage: {
    color: Colors.neutral600,
  },
  conversationTime: {
    color: Colors.neutral500,
    marginLeft: Spacing.md,
  },
  noContentText: {
    color: Colors.neutral600,
    textAlign: 'center',
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  unreadBadge: {
    backgroundColor: Colors.accent500, // Use an accent color for the badge
    borderRadius: Radii.round,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxs,
    marginLeft: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: Colors.neutral50,
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
    flexDirection: 'column',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary500,
    borderBottomRightRadius: Radii.sm,
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.neutral200,
    borderBottomLeftRadius: Radii.sm,
    alignItems: 'flex-start',
  },
  myMessageText: {
    color: Colors.neutral50,
    textAlign: 'right',
  },
  otherMessageText: {
    color: Colors.neutral800,
    textAlign: 'left',
  },
  myMessageTime: {
    color: Colors.primary100,
    alignSelf: 'flex-end',
    marginTop: Spacing.xxs,
  },
  otherMessageTime: {
    color: Colors.neutral600,
    alignSelf: 'flex-start',
    marginTop: Spacing.xxs,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xxs,
  },
  readIcon: {
    marginLeft: Spacing.xxs,
  },
  senderName: {
    color: Colors.neutral700,
    marginBottom: Spacing.xxs,
    fontWeight: 'bold',
  },
  typingIndicator: {
    color: Colors.neutral600,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.neutral50,
    paddingHorizontal: Spacing.lg,
    ...Shadows.sm,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    height: 80,
    backgroundColor: Colors.neutral50,
    paddingHorizontal: Spacing.md,
    zIndex: 999,
    width: Dimensions.get('window').width,
  },
  messageInput: {
    flex: 1,
    marginRight: Spacing.sm,
    maxHeight: 150,
  },
  sendButton: {
    backgroundColor: Colors.primary500,
    width: Spacing.xxl,
    height: Spacing.xxl,
    borderRadius: Radii.round,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
    position: 'absolute',
    right: Spacing.md,
    bottom: 25,
  },
});

export default MessagesScreen;