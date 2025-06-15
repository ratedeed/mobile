import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import io from 'socket.io-client';
import { fetchConversations, fetchMessages, sendMessage } from '../api/messages';
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/common/Header';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import { useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../config'; // Import API_BASE_URL

const MessagesScreen = () => {
  const route = useRoute();
  const { recipientId, recipientName } = route.params || {};

  console.log('MessagesScreen: route.params:', route.params);
  console.log('MessagesScreen: recipientId:', recipientId);
  console.log('MessagesScreen: recipientName:', recipientName);
 
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
 
  // Dummy user ID for demonstration. In a real app, this would come from auth context/storage.
  // For testing, using a user ID from the provided log that is a contractor.
  const DUMMY_CURRENT_USER_ID = '684d745968c6888a0c30833a'; // Updated based on backend logs

  useEffect(() => {
    const initializeMessages = async () => {
      setLoading(true);
      try {
        console.log('initializeMessages: recipientId at start:', recipientId);
        if (recipientId) {
          // Try to find an existing conversation with this recipient
          const existingConversations = await fetchConversations();
          console.log('initializeMessages: existingConversations:', existingConversations);
          const foundConversation = existingConversations.find(conv =>
            conv.otherParticipant && conv.otherParticipant._id === recipientId
          );
 
          if (foundConversation) {
            console.log('initializeMessages: Found existing conversation:', foundConversation);
            setSelectedConversation(foundConversation);
            await loadMessages(foundConversation.otherParticipant._id); // Load messages for existing conversation
          } else {
            // Prepare for a new conversation with this recipient
            const newMockConversation = {
              _id: recipientId, // This will be used as the 'otherUserId' for sendMessage and fetchMessages
              name: recipientName,
              otherParticipant: { _id: recipientId, firstName: recipientName.split(' ')[0], lastName: recipientName.split(' ')[1] || '' }, // Mock otherParticipant for consistency
            };
            console.log('initializeMessages: Preparing new mock conversation:', newMockConversation);
            setSelectedConversation(newMockConversation);
            setMessages([]); // No messages yet for a new conversation
          }
        } else {
          console.log('initializeMessages: No recipientId, loading all conversations.');
          loadConversations();
        }
      } catch (error) {
        Alert.alert('Error', error.message || 'Failed to initialize messages.');
        console.error('Initialize messages error:', error);
      } finally {
        setLoading(false);
        console.log('initializeMessages: Loading finished, selectedConversation:', selectedConversation);
      }
    };
    initializeMessages();
  }, [recipientId, DUMMY_CURRENT_USER_ID]);
 
  useEffect(() => {
    console.log('selectedConversation useEffect triggered. selectedConversation:', selectedConversation);
    if (selectedConversation && selectedConversation.otherParticipant && selectedConversation.otherParticipant._id) {
      console.log('selectedConversation useEffect: Loading messages for existing conversation with otherUserId:', selectedConversation.otherParticipant._id);
      loadMessages(selectedConversation.otherParticipant._id);
    } else if (selectedConversation && !selectedConversation.otherParticipant && recipientId) {
      console.log('selectedConversation useEffect: New conversation, setting messages to empty.');
      setMessages([]);
    }
  }, [selectedConversation]);

  useEffect(() => {
    const socket = io(API_BASE_URL);

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('register', DUMMY_CURRENT_USER_ID); // Register current user with their ID
    });

    socket.on('newMessage', (message) => {
      console.log('New message received via socket:', message);
      // Only add message if it belongs to the currently selected conversation
      const targetRecipientId = selectedConversation?.otherParticipant?._id || selectedConversation?._id;
      if (
        (message.senderId._id === DUMMY_CURRENT_USER_ID && message.recipientId._id === targetRecipientId) ||
        (message.senderId._id === targetRecipientId && message.recipientId._id === DUMMY_CURRENT_USER_ID)
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
  }, [selectedConversation, DUMMY_CURRENT_USER_ID]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(data);
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

      await sendMessage(targetRecipientId, newMessage); // Corrected parameters
      setNewMessage('');
      await loadMessages(targetRecipientId); // Reload messages to show the new one
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
          title={selectedConversation ? (selectedConversation.name || recipientName || (selectedConversation.otherParticipant ? `${selectedConversation.otherParticipant.firstName} ${selectedConversation.otherParticipant.lastName}` : `Conversation`)) : "Messages"}
          showBackButton={!!selectedConversation}
          onBackPress={() => setSelectedConversation(null)} // Custom back press to show conversation list
          rightComponent={selectedConversation ? <Avatar text={selectedConversation.name || recipientName || (selectedConversation.otherParticipant ? `${selectedConversation.otherParticipant.firstName} ${selectedConversation.otherParticipant.lastName}` : `Conversation`)} size={Spacing.lg} /> : null}
        />

        {/* Conditional rendering for conversation list or messages list */}
        {!selectedConversation ? (
          <ScrollView style={styles.conversationList} contentContainerStyle={styles.conversationListContent}>
            {conversations.length > 0 ? (
              conversations.map((conv) => (
                <Card key={conv.lastMessage._id} style={styles.conversationCard}>
                  <TouchableOpacity
                    onPress={() => setSelectedConversation(conv)}
                    style={styles.conversationTouchable}
                  >
                    <Avatar text={conv.otherParticipant.firstName + ' ' + conv.otherParticipant.lastName} size={Spacing.xxl} style={styles.conversationAvatar} />
                    <View style={styles.conversationTextContent}>
                      <Typography variant="h6" style={styles.conversationName}>{`Conversation with ${conv.otherParticipant.firstName} ${conv.otherParticipant.lastName}`}</Typography>
                      <Typography variant="body" style={styles.lastMessage}>{conv.lastMessage.messageText || 'No messages yet.'}</Typography>
                    </View>
                    <Typography variant="caption" style={styles.conversationTime}>{formatMessageTime(conv.lastMessage.createdAt)}</Typography>
                  </TouchableOpacity>
                </Card>
              ))
            ) : (
              <Typography variant="body" style={styles.noContentText}>No conversations yet. Start a new chat!</Typography>
            )}
          </ScrollView>
        ) : (
          <ScrollView style={styles.messagesList} contentContainerStyle={styles.messagesListContent}>
            {messages.length > 0 ? (
              messages.map((msg) => (
                <View
                  key={msg._id}
                  style={[
                    styles.messageBubble,
                    msg.senderId._id === DUMMY_CURRENT_USER_ID ? styles.myMessage : styles.otherMessage
                  ]}
                >
                  <Typography variant="body" style={msg.senderId._id === DUMMY_CURRENT_USER_ID ? styles.myMessageText : styles.otherMessageText}>{msg.messageText}</Typography>
                  <Typography variant="caption" style={msg.senderId._id === DUMMY_CURRENT_USER_ID ? styles.myMessageTime : styles.otherMessageTime}>{formatMessageTime(msg.createdAt)}</Typography>
                </View>
              ))
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
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.lg,
    marginBottom: Spacing.sm,
    ...Shadows.xs,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary500, // Purple background
    borderBottomRightRadius: Radii.sm,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.neutral200,
    borderBottomLeftRadius: Radii.sm,
  },
  myMessageText: {
    color: Colors.neutral50, // White text for purple background
  },
  otherMessageText: {
    color: Colors.neutral800,
  },
  myMessageTime: {
    color: Colors.primary100, // Lighter purple for time
    alignSelf: 'flex-end',
    marginTop: Spacing.xxs,
  },
  otherMessageTime: {
    color: Colors.neutral600,
    alignSelf: 'flex-start',
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