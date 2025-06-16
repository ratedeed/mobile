import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode
import { fetchConversations, fetchMessages, sendMessage } from '../api/messages';
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/common/Header';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config'; // Import API_BASE_URL

const getParticipantDisplayName = (participant) => {
  console.log('getParticipantDisplayName: Received participant:', participant);
  if (!participant) {
    console.log('getParticipantDisplayName: Participant is null/undefined, returning "Unknown".');
    return 'Unknown';
  }
  if (participant.name) {
    console.log('getParticipantDisplayName: Using participant.name:', participant.name);
    return participant.name; // Prioritize 'name' if already set (e.g., from newConversation)
  }
  if (participant.role === 'User') {
    const name = `${participant.firstName || ''} ${participant.lastName || ''}`.trim();
    console.log('getParticipantDisplayName: Participant is User. Constructed name:', name);
    return name || 'Unknown User';
  }
  if (participant.role === 'Contractor') {
    console.log('getParticipantDisplayName: Participant is Contractor. Using companyName:', participant.companyName);
    return participant.companyName || 'Unknown Contractor';
  }
  console.log('getParticipantDisplayName: No specific role/name found, returning "Unknown".');
  return 'Unknown';
};

const MessagesScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { recipientId, recipientName } = route.params || {};
  console.log('MessagesScreen (initial render): route.params:', route.params);
  console.log('MessagesScreen (initial render): recipientId:', recipientId);
  console.log('MessagesScreen (initial render): recipientName:', recipientName);
  console.log('MessagesScreen (initial render): route.name:', route.name);
 
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
 
  const [currentUserId, setCurrentUserId] = useState(null); // State to store current user ID

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

  // Use a separate useEffect for handling initial load based on recipientId
  useEffect(() => {
    const initializeSpecificChat = async () => {
      if (route.name === 'ChatScreen' && recipientId && currentUserId) { // Add currentUserId dependency
        setLoading(true);
        console.log('initializeSpecificChat: recipientId:', recipientId);
        try {
          const existingConversations = await fetchConversations();
          console.log('initializeSpecificChat: existingConversations:', existingConversations);
          const foundConversation = existingConversations.find(conv => {
            console.log('initializeSpecificChat: Comparing conv.otherParticipant._id:', conv.otherParticipant?._id, 'with recipientId:', recipientId);
            return conv.otherParticipant && conv.otherParticipant._id === recipientId;
          });
          console.log('initializeSpecificChat: foundConversation:', foundConversation);

          if (foundConversation) {
            setSelectedConversation(foundConversation);
            await loadMessages(foundConversation.otherParticipant._id);
          } else {
            const newMockConversation = {
              _id: recipientId,
              name: recipientName,
              otherParticipant: { _id: recipientId, firstName: recipientName.split(' ')[0], lastName: recipientName.split(' ')[1] || '' },
            };
            setSelectedConversation(newMockConversation);
            setMessages([]);
          }
        } catch (error) {
          Alert.alert('Error', error.message || 'Failed to initialize specific chat.');
          console.error('Initialize specific chat error:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    initializeSpecificChat();
  }, [route.name, recipientId, currentUserId]); // Add currentUserId to dependencies

  // Use another useEffect to handle tab focus for loading all conversations
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('MessagesScreen: Focus event detected. Current route name:', route.name);
      if (route.name === 'Messages') {
        console.log('MessagesScreen: Tab focused - loading all conversations.');
        loadConversations();
        setSelectedConversation(null); // Ensure conversation list is shown
      }
    });

    return unsubscribe; // Cleanup the listener
  }, [navigation, route.name]); // Add navigation and route.name to dependencies

  useEffect(() => {
    if (selectedConversation && selectedConversation.otherParticipant && selectedConversation.otherParticipant._id) {
      loadMessages(selectedConversation.otherParticipant._id);
    } else if (selectedConversation && !selectedConversation.otherParticipant && recipientId) {
      console.log('selectedConversation useEffect: New conversation, setting messages to empty.');
      setMessages([]);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (!currentUserId) return; // Only proceed if currentUserId is available

    const socket = io(API_BASE_URL);

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('register', currentUserId); // Register current user with their ID
    });

    socket.on('newMessage', (message) => {
      console.log('New message received via socket:', message);

      const senderId = message.senderId._id;
      const recipientId = message.recipientId._id;
      console.log('newMessage: currentUserId:', currentUserId);
      console.log('newMessage: senderId (full object):', message.senderId); // Log full object
      console.log('newMessage: recipientId (full object):', message.recipientId); // Log full object
      console.log('newMessage: senderId (ID only):', senderId, 'recipientId (ID only):', recipientId);
      const otherParticipantId = senderId === currentUserId ? recipientId : senderId;
      console.log('newMessage: otherParticipantId (calculated):', otherParticipantId);

      let updatedSelectedConversation = selectedConversation; // Keep track if selected conversation is updated

      setConversations((prevConversations) => {
        let conversationFound = false;
        const updatedConversations = prevConversations.map((conv) => {
          const isMatch = conv.otherParticipant && conv.otherParticipant._id === otherParticipantId;
          console.log(`newMessage: Comparing conv.otherParticipant._id: ${conv.otherParticipant?._id} with otherParticipantId: ${otherParticipantId}. Match: ${isMatch}`);
          if (isMatch) {
            conversationFound = true;
            console.log('newMessage: Matched existing conversation:', conv._id);
            const updatedConv = {
              ...conv,
              lastMessage: {
                _id: message._id,
                messageText: message.messageText,
                createdAt: message.createdAt,
              },
              // Increment unreadCount if the message is from the other participant and not currently selected
              unreadCount: (conv.unreadCount || 0) + (senderId === otherParticipantId && (!selectedConversation || selectedConversation._id !== conv._id) ? 1 : 0),
            };
            // If this is the currently selected conversation, update our local reference
            if (selectedConversation && selectedConversation.otherParticipant && selectedConversation.otherParticipant._id === otherParticipantId) {
              updatedSelectedConversation = updatedConv;
            }
            return updatedConv;
          }
          return conv;
        });
        if (!conversationFound) {
          console.log('newMessage: No existing conversation found. Creating new one.');
          console.log('newMessage: message.conversationId:', message.conversationId);
          // Determine the other participant based on who sent the message
          const rawOtherParticipant = senderId === currentUserId
            ? message.recipientId
            : message.senderId;

          // Construct otherParticipant with necessary fields, handling missing data
          // Prioritize existing name fields if available, otherwise use a placeholder
          const otherParticipant = {
            _id: rawOtherParticipant._id,
            firstName: rawOtherParticipant.firstName || '',
            lastName: rawOtherParticipant.lastName || '',
            companyName: rawOtherParticipant.companyName || '',
            role: rawOtherParticipant.role || 'User', // Default role if not provided
          };

          // Refine the name based on role for display
          let displayName = 'Unknown';
          if (otherParticipant.role === 'User') {
            displayName = `${otherParticipant.firstName} ${otherParticipant.lastName}`.trim();
            if (!displayName) displayName = 'Unknown User';
          } else if (otherParticipant.role === 'Contractor') {
            displayName = otherParticipant.companyName || 'Unknown Contractor';
          }
          console.log('newMessage: Constructed new otherParticipant:', otherParticipant);
          console.log('newMessage: Display Name for new conversation:', displayName);

          const newConversation = {
            _id: message.conversationId || `temp-${Date.now()}`, // Use conversationId if available, otherwise a temp ID
            lastMessage: {
              _id: message._id,
              messageText: message.messageText,
              createdAt: message.createdAt,
            },
            otherParticipant: { // Ensure otherParticipant is a full object for rendering
              _id: otherParticipant._id,
              firstName: otherParticipant.firstName,
              lastName: otherParticipant.lastName,
              companyName: otherParticipant.companyName,
              role: otherParticipant.role,
              name: displayName, // Add a 'name' property for easier display in Header and Avatar
            },
            unreadCount: senderId === otherParticipant._id ? 1 : 0, // Mark as unread if received from other participant
          };
          // Prepend the new conversation to the list
          return [newConversation, ...updatedConversations].sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
        }

        // No redundant return statements needed here
      });

      // Update selectedConversation state if it was the one that received the new message
      console.log('newMessage: updatedSelectedConversation after map:', updatedSelectedConversation);
      console.log('newMessage: selectedConversation before update:', selectedConversation);
      if (updatedSelectedConversation !== selectedConversation) {
        setSelectedConversation(updatedSelectedConversation);
        console.log('newMessage: selectedConversation updated to:', updatedSelectedConversation);
      }

      // If the message belongs to the currently selected conversation, add it to messages state
      const targetRecipientId = selectedConversation?.otherParticipant?._id || selectedConversation?._id;
      if (
        (senderId === currentUserId && recipientId === targetRecipientId) ||
        (senderId === targetRecipientId && recipientId === currentUserId)
      ) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedConversation, currentUserId]); // Add currentUserId to dependencies

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await fetchConversations();
      console.log('loadConversations: Data fetched from API:', data);
      setConversations(data);
      console.log('loadConversations: conversations state set to:', data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load conversations.');
      console.error('Load conversations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId) => { // Changed parameter name
    setLoading(true);
    try {
      const data = await fetchMessages(otherUserId); // Pass otherUserId
      setMessages(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load messages.');
      console.error('Load messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) {
      return;
    }

    try {
      // The recipientId for sendMessage is always the ID of the 'other' participant in the conversation
      const targetRecipientId = selectedConversation.otherParticipant ? selectedConversation.otherParticipant._id : selectedConversation._id;

      const sentMessage = await sendMessage(targetRecipientId, newMessage); // Corrected parameters
      setNewMessage('');
      setMessages((prevMessages) => [...prevMessages, sentMessage]); // Add the sent message to the state
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send message.');
      console.error('Send message error:', error);
    }
  };

  const formatMessageTime = (timestamp) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - messageDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return messageDate.toLocaleDateString([], { weekday: 'short' });
    } else {
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
            const participantForHeader = selectedConversation?.otherParticipant || selectedConversation;
            const displayName = getParticipantDisplayName(participantForHeader);
            console.log('MessagesScreen: Header title participant:', participantForHeader, 'Display Name:', displayName);
            return displayName;
          })()}
          showBackButton={!!selectedConversation}
          onBackPress={() => setSelectedConversation(null)} // Custom back press to show conversation list
          rightComponent={(() => {
            const participantForAvatar = selectedConversation?.otherParticipant || selectedConversation;
            const displayName = getParticipantDisplayName(participantForAvatar);
            console.log('MessagesScreen: Avatar text participant:', participantForAvatar, 'Display Name:', displayName);
            return selectedConversation ? <Avatar text={displayName} size={Spacing.lg} /> : null;
          })()}
        />

        {/* Conditional rendering for conversation list or messages list */}
        {!selectedConversation ? (
          <ScrollView style={styles.conversationList} contentContainerStyle={styles.conversationListContent}>
            {conversations.length > 0 ?
              conversations.map((conv) => {
                console.log('Rendering conversation:', conv); // Log each conversation object
                if (!conv.lastMessage || !conv.otherParticipant) {
                  console.warn('Skipping conversation due to missing lastMessage or otherParticipant:', conv);
                  return null; // Skip rendering if essential data is missing
                }
                return (
                  <Card key={conv.lastMessage._id} style={styles.conversationCard}>
                    <TouchableOpacity
                      onPress={() => setSelectedConversation(conv)}
                      style={styles.conversationTouchable}
                    >
                      <Avatar text={getParticipantDisplayName(conv.otherParticipant)} size={Spacing.xxl} style={styles.conversationAvatar} />
                      <View style={styles.conversationTextContent}>
                        <Typography variant="h6" style={styles.conversationName}>{`Conversation with ${getParticipantDisplayName(conv.otherParticipant)}`}</Typography>
                        <Typography variant="body" style={styles.lastMessage}>{conv.lastMessage.messageText || 'No messages yet.'}</Typography>
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
          <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesListContent}>
            {messages.length > 0 ? (
              messages.map((msg) => {
                console.log('Message senderId:', msg.senderId._id, 'currentUserId:', currentUserId, 'Is my message:', msg.senderId._id === currentUserId);
                return (
                  <View
                    key={msg._id}
                    style={[
                      styles.messageBubble,
                      msg.senderId._id === currentUserId ? styles.myMessage : styles.otherMessage
                    ]}
                  >
                    <Typography variant="body" style={msg.senderId._id === currentUserId ? styles.myMessageText : styles.otherMessageText}>{msg.messageText}</Typography>
                    <Typography variant="caption" style={msg.senderId._id === currentUserId ? styles.myMessageTime : styles.otherMessageTime}>{formatMessageTime(msg.createdAt)}</Typography>
                  </View>
                );
              })
            ) : (
              <Typography variant="body" style={styles.noContentText}>No messages in this conversation yet. Say hello!</Typography>
            )}
          </ScrollView>
        )}

        {/* Message input container - only visible when a conversation is selected */}
        {selectedConversation && (
          <View style={styles.messageInputContainer}>
            <Input
              style={styles.messageInput}
              placeholder="Type your message..."
              placeholderTextColor={Colors.neutral500}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline // Re-enable multiline
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
  // Removed chatContainer style as it's no longer needed with the simplified layout
  // chatContainer: {
  //   flex: 1,
  //   width: '100%',
  //   flexDirection: 'column',
  // },
  messagesList: {
    flex: 1, // Use flex: 1 to ensure it takes available space
  },
  messagesListContent: {
    flexGrow: 1, // Allow content to grow
    justifyContent: 'flex-end', // Stick messages to the bottom
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    // Removed alignItems: 'flex-start' to allow individual message bubbles to control their alignment
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
    flexDirection: 'column', // Ensure content within bubble stacks vertically
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary500, // Purple background
    borderBottomRightRadius: Radii.sm,
    alignItems: 'flex-end', // Align content within my message bubble to the right
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.neutral200,
    borderBottomLeftRadius: Radii.sm,
    alignItems: 'flex-start', // Align content within other message bubble to the left
  },
  myMessageText: {
    color: Colors.neutral50, // White text for purple background
    textAlign: 'right', // Ensure text is right-aligned within the bubble
  },
  otherMessageText: {
    color: Colors.neutral800,
    textAlign: 'left', // Ensure text is left-aligned within the bubble
  },
  myMessageTime: {
    color: Colors.primary100, // Lighter purple for time
    alignSelf: 'flex-end', // Keep time aligned to the end of the bubble
    marginTop: Spacing.xxs,
  },
  otherMessageTime: {
    color: Colors.neutral600,
    alignSelf: 'flex-start', // Keep time aligned to the start of the bubble
    marginTop: Spacing.xxs,
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
    width: Dimensions.get('window').width, // Ensure it takes full width
  },
  messageInput: {
    flex: 1,
    marginRight: Spacing.sm, // Add some space between input and button
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
    right: Spacing.md, // Align with the container's horizontal padding
    bottom: 25, // Moved further higher
  },
});

export default MessagesScreen;