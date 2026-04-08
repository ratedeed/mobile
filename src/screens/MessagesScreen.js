import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  createConversation,
  registerSocket,
  joinConversationSocket,
  leaveConversationSocket,
  onNewMessage,
  onMessageRead,
  onTyping,
  onUserOnlineStatus,
  emitTyping,
  emitMessageRead,
} from '../api/messages';
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/common/Header';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import ReportButton from '../components/ReportButton';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import { useRoute, useNavigation } from '@react-navigation/native';

const getParticipantDisplayName = (entity, currentUserId) => {
  if (!entity) {
    return 'Unknown';
  }

  if (entity.businessName) {
    return entity.businessName;
  }
  if (entity.companyName) {
    return entity.companyName;
  }
  const nameFromFirstLast = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
  if (nameFromFirstLast) {
    return nameFromFirstLast;
  }
  if (entity.name && entity.name !== 'Unknown') {
    return entity.name;
  }

  if (entity.participants && Array.isArray(entity.participants) && currentUserId) {
    const otherParticipantInConvo = entity.participants.find(p => p._id && p._id.toString() !== currentUserId.toString());
    if (otherParticipantInConvo) {
      const nameFromNestedParticipant = getParticipantDisplayName(otherParticipantInConvo);
      if (nameFromNestedParticipant && nameFromNestedParticipant !== 'Unknown') {
        return nameFromNestedParticipant;
      }
    }
  }

  if (entity.otherParticipant) {
    const nameFromOtherParticipantProp = getParticipantDisplayName(entity.otherParticipant);
    if (nameFromOtherParticipantProp && nameFromOtherParticipantProp !== 'Unknown') {
      return nameFromOtherParticipantProp;
    }
  }

  if (entity.role && entity.role.toLowerCase() === 'contractor') {
    return 'Unknown Contractor';
  }
  if (entity.role && entity.role.toLowerCase() === 'user') {
    return 'Unknown User';
  }

  return 'Unknown';
};

const MessagesScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { recipientId, recipientName } = route.params || {};
  
  const [conversations, setConversations] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesScrollViewRef = useRef();
  const selectedConversationRef = useRef(selectedConversation);
  
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});

  const saveConversationsToStorage = async (convs) => {
    try {
      await AsyncStorage.setItem('conversations', JSON.stringify(convs));
    } catch (error) {
      console.error('Error saving conversations to AsyncStorage:', error);
    }
  };

  const loadConversationsFromStorage = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('conversations');
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error loading conversations from AsyncStorage:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const userInfo = await AsyncStorage.getItem('userInfo');
        if (userInfo) {
          const parsed = JSON.parse(userInfo);
          const decodedToken = jwtDecode(parsed.token);
          setCurrentUserId(decodedToken.id);
        }
      } catch (error) {
        console.error('Error fetching user ID from token:', error);
      }
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    const initializeSpecificChat = async () => {
      if (route.name === 'ChatScreen' && recipientId && currentUserId) {
        setLoading(true);
        try {
          const fetchedConversations = await fetchConversations();
          const conversationsMap = fetchedConversations.reduce((acc, conv) => {
            acc[conv.conversationId] = { ...conv, _id: conv.conversationId };
            return acc;
          }, {});
          setConversations(conversationsMap);

          const foundConversation = Object.values(conversationsMap).find(conv => {
            return conv.participants.some(p => p._id === recipientId);
          });

          if (foundConversation) {
            setSelectedConversation(foundConversation);
            await loadMessages(foundConversation.conversationId);
          } else {
            const newMockConversation = {
              _id: `temp-${recipientId}`,
              conversationId: `temp-${recipientId}`,
              name: recipientName,
              businessName: recipientName,
              companyName: recipientName,
              participants: [
                { _id: currentUserId, role: 'User' },
                { _id: recipientId, name: recipientName, role: 'Contractor' }
              ],
              otherParticipant: {
                _id: recipientId,
                name: recipientName,
                role: 'Contractor',
                businessName: recipientName,
                companyName: recipientName,
              },
              messages: [],
            };
            setSelectedConversation(newMockConversation);
            setMessages([]);
          }
        } catch (error) {
          Alert.alert('Error', error.message || 'Failed to initialize specific chat.');
        } finally {
          setLoading(false);
        }
      }
    };
    initializeSpecificChat();
  }, [route.name, recipientId, currentUserId, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.name === 'Messages' && currentUserId) {
        loadConversations();
        setSelectedConversation(null);
      }
    });

    return unsubscribe;
  }, [navigation, route.name, currentUserId]);

  useEffect(() => {
    if (selectedConversation?.conversationId && currentUserId) {
      if (selectedConversation.conversationId?.startsWith('temp-')) {
        setMessages([]);
      } else {
        loadMessages(selectedConversation.conversationId);
      }
    }
  }, [selectedConversation, currentUserId]);

  useEffect(() => {
    if (messagesScrollViewRef.current) {
      messagesScrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    if (!currentUserId) return;

    registerSocket(currentUserId);

    const handleNewMessage = (message) => {
      const senderId = message.senderId?._id;
      const recipientId = message.recipientId?._id;

      if (!senderId || !recipientId) {
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
        if (!otherParticipant || !otherParticipant.name || otherParticipant.name === 'Unknown' || !otherParticipant.role) {
          const rawOtherParticipant = message.senderId._id === currentUserId
            ? message.recipientId
            : message.senderId;

          let displayName = 'Unknown';
          let firstName = '';
          let lastName = '';
          let businessName = '';
          let profilePicture = '';
          let role = rawOtherParticipant.role || 'User';

          if (role.toLowerCase() === 'user') {
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
            displayName = `${firstName} ${lastName}`.trim();
            if (!displayName) displayName = 'Unknown User';
            profilePicture = rawOtherParticipant.profilePicture || '';
          } else if (role.toLowerCase() === 'contractor') {
            businessName = rawOtherParticipant.businessName || rawOtherParticipant.companyName || '';
            displayName = businessName;
            if (!displayName) displayName = 'Unknown Contractor';
            profilePicture = rawOtherParticipant.profilePicture || '';
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
          }

          otherParticipant = {
            _id: rawOtherParticipant._id,
            firstName: firstName,
            lastName: lastName,
            businessName: businessName,
            profilePicture: profilePicture,
            role: role,
            name: displayName,
          };
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
          const existingMessageIds = new Set(prevMessages.map(m => m._id));
          if (existingMessageIds.has(message._id)) {
            return prevMessages;
          }
          const updatedMsgs = [...prevMessages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return updatedMsgs;
        });
        if (message.recipientId._id === currentUserId && !message.read) {
          emitMessageRead(message._id, currentUserId);
        }
      }
    };

    const handleMessageRead = ({ messageId, conversationId, readerId }) => {
      setConversations(prevConversations => {
        const updatedConvos = { ...prevConversations };
        if (updatedConvos[conversationId]) {
          const updatedMessages = updatedConvos[conversationId].messages.map(msg =>
            msg._id === messageId ? { ...msg, read: true } : msg
          );
          updatedConvos[conversationId] = {
            ...updatedConvos[conversationId],
            messages: updatedMessages,
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
      setTypingUsers(prev => ({
        ...prev,
        [selectedConversationRef.current?.conversationId]: {
          ...prev[selectedConversationRef.current?.conversationId],
          [userId]: isTyping
        }
      }));
    };

    const handleUserOnlineStatus = ({ userId, isOnline }) => {
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
      onNewMessage(() => {});
      onMessageRead(() => {});
      onTyping(() => {});
      onUserOnlineStatus(() => {});
      leaveConversationSocket(selectedConversationRef.current?._id);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (selectedConversation?.conversationId && currentUserId) {
      if (!selectedConversation.conversationId?.startsWith('temp-')) {
        joinConversationSocket(selectedConversation.conversationId);
        setConversations(prev => {
          const updatedConvos = { ...prev };
          if (updatedConvos[selectedConversation.conversationId]) {
            updatedConvos[selectedConversation.conversationId] = {
              ...updatedConvos[selectedConversation.conversationId],
              unreadCount: 0,
            };
          }
          return updatedConvos;
        });
        messages.forEach(msg => {
          if (msg.recipientId && msg.recipientId._id.toString() === currentUserId && !msg.read) {
            emitMessageRead(msg._id, currentUserId);
          }
        });
      }
    }
    return () => {
      if (selectedConversation?.conversationId && !selectedConversation.conversationId?.startsWith('temp-')) {
        leaveConversationSocket(selectedConversation.conversationId);
      }
    };
  }, [selectedConversation, currentUserId, messages]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const fetchedConversations = await fetchConversations();
      let conversationsMap = await loadConversationsFromStorage() || {};

      const apiFetchedConversations = await fetchConversations();

      apiFetchedConversations.forEach(conv => {
        conversationsMap[conv.conversationId] = {
          ...conversationsMap[conv.conversationId],
          ...conv,
          _id: conv.conversationId,
          messages: [],
          fragmentConversationIds: conversationsMap[conv.conversationId]?.fragmentConversationIds || [],
        };
        const other = conv.participants.find(p => {
          return p._id && currentUserId && p._id.toString() !== currentUserId.toString();
        });
        if (other) {
          const otherParticipantDetails = {
            _id: other._id,
            firstName: other.firstName || '',
            lastName: other.lastName || '',
            businessName: other.businessName || '',
            companyName: other.companyName || '',
            profilePicture: other.profilePicture || '',
            role: (other.businessName || other.companyName) ? 'Contractor' : (other.role || 'User'),
          };
          otherParticipantDetails.name = getParticipantDisplayName(otherParticipantDetails, currentUserId);
          conversationsMap[conv.conversationId].otherParticipant = otherParticipantDetails;
        }
      });

      for (const convId in conversationsMap) {
        if (!apiFetchedConversations.some(fc => fc.conversationId === convId)) {
          delete conversationsMap[convId];
        }
      }

      const groups = Object.values(conversationsMap).reduce((acc, convo) => {
        const other = convo.participants.find(p => {
          return p._id && currentUserId && p._id.toString() !== currentUserId.toString();
        });
        if (other) {
          const otherId = other._id.toString();
          acc[otherId] = acc[otherId] || [];
          acc[otherId].push(convo);
        }
        return acc;
      }, {});

      Object.entries(groups).forEach(([otherId, convos]) => {
        if (convos.length > 1) {
          const canonical = convos.reduce((keep, c) =>
            new Date(c.lastMessage?.createdAt || 0) < new Date(keep.lastMessage?.createdAt || 0) ? c : keep
          );

          const fragmentIds = convos
            .filter(c => c.conversationId !== canonical.conversationId)
            .map(c => c.conversationId);

          conversationsMap[canonical.conversationId] = {
            ...canonical,
            fragmentConversationIds: [...(canonical.fragmentConversationIds || []), ...fragmentIds],
            messages: [],
          };

          fragmentIds.forEach(id => {
            delete conversationsMap[id];
          });
        }
      });

      setConversations(conversationsMap);
      await saveConversationsToStorage(conversationsMap);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    setLoading(true);
    try {
      const fetchedMessages = await fetchMessages(conversationId);
      const sortedMessages = fetchedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(sortedMessages);

      setConversations(prev => {
        const updatedConvos = { ...prev };
        if (updatedConvos[conversationId]) {
          updatedConvos[conversationId] = {
            ...updatedConvos[conversationId],
            messages: sortedMessages,
            unreadCount: 0,
          };
        }
        saveConversationsToStorage(updatedConvos);
        return updatedConvos;
      });

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUserId) {
      return;
    }

    try {
      let finalConversationId = selectedConversation.conversationId;
      let targetRecipientId;

      if (selectedConversation.conversationId?.startsWith('temp-')) {
        const { conversationId: newConvoId, participants: newConvoParticipants } = await createConversation([currentUserId, recipientId]);
        finalConversationId = newConvoId;
        
        const rawActualOtherParticipant = newConvoParticipants.find(p => p._id && p._id.toString() !== currentUserId.toString());

        let processedOtherParticipant = {
          _id: rawActualOtherParticipant._id,
          firstName: rawActualOtherParticipant.firstName || '',
          lastName: rawActualOtherParticipant.lastName || '',
          businessName: rawActualOtherParticipant.businessName || rawActualOtherParticipant.companyName || '',
          profilePicture: rawActualOtherParticipant.profilePicture || '',
          role: (rawActualOtherParticipant.businessName || rawActualOtherParticipant.companyName) ? 'Contractor' : (rawActualOtherParticipant.role || 'User'),
        };
        processedOtherParticipant.name = getParticipantDisplayName(processedOtherParticipant, currentUserId);
        
        setSelectedConversation(prev => {
          const updatedSelected = {
            ...prev,
            _id: newConvoId,
            conversationId: newConvoId,
            otherParticipant: processedOtherParticipant,
            participants: newConvoParticipants,
          };
          return updatedSelected;
        });

        setConversations(prev => {
          const updatedConversationsMap = {
            ...prev,
            [newConvoId]: {
              _id: newConvoId,
              conversationId: newConvoId,
              participants: newConvoParticipants,
              otherParticipant: processedOtherParticipant,
              messages: [],
              lastMessage: null,
              unreadCount: 0,
            }
          };
          if (selectedConversation.conversationId?.startsWith('temp-')) {
            delete updatedConversationsMap[selectedConversation.conversationId];
          }
          return updatedConversationsMap;
        });
        joinConversationSocket(finalConversationId);
        targetRecipientId = processedOtherParticipant._id;
      } else {
        const otherParticipant = selectedConversation.participants.find(
          p => p._id && p._id.toString() !== currentUserId.toString()
        );
        targetRecipientId = otherParticipant?._id;
      }

      if (!targetRecipientId) {
        Alert.alert('Error', 'Could not determine recipient for message.');
        return;
      }

      const sentMessage = await sendMessage(finalConversationId, targetRecipientId, newMessage);
      setNewMessage('');
      emitTyping(finalConversationId, currentUserId, false);

      setConversations(prev => {
        const currentConvo = prev[sentMessage.conversationId] || {
          _id: sentMessage.conversationId,
          conversationId: sentMessage.conversationId,
          participants: [],
          messages: [],
          lastMessage: null,
          unreadCount: 0,
          otherParticipant: null,
        };

        let otherParticipant = currentConvo.otherParticipant;
        if (!otherParticipant || !otherParticipant.name || otherParticipant.name === 'Unknown' || (!otherParticipant.businessName && otherParticipant.role === 'Contractor')) {
          const rawOtherParticipant = sentMessage.senderId._id === currentUserId
            ? sentMessage.recipientId
            : sentMessage.senderId;

          let displayName = 'Unknown';
          let firstName = '';
          let lastName = '';
          let businessName = '';
          let profilePicture = '';
          let role = rawOtherParticipant.role || 'User';

          if (rawOtherParticipant.role === 'User') {
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
            displayName = `${firstName} ${lastName}`.trim();
            if (!displayName) displayName = 'Unknown User';
            profilePicture = rawOtherParticipant.profilePicture || '';
          } else if (rawOtherParticipant.role === 'Contractor') {
            businessName = rawOtherParticipant.businessName || '';
            displayName = businessName;
            if (!displayName) displayName = 'Unknown Contractor';
            profilePicture = rawOtherParticipant.profilePicture || '';
            firstName = rawOtherParticipant.firstName || '';
            lastName = rawOtherParticipant.lastName || '';
          }

          otherParticipant = {
            _id: rawOtherParticipant._id,
            firstName: firstName,
            lastName: lastName,
            businessName: businessName,
            profilePicture: profilePicture,
            role: role,
            name: displayName,
          };
        }

        const updatedConvoMessages = [...currentConvo.messages];
        if (!updatedConvoMessages.some(m => m._id === sentMessage._id)) {
          updatedConvoMessages.push(sentMessage);
        }
        updatedConvoMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        return {
          ...prev,
          [sentMessage.conversationId]: {
            ...currentConvo,
            messages: updatedConvoMessages,
            lastMessage: sentMessage,
            otherParticipant: otherParticipant,
            unreadCount: 0,
          },
        };
      });

      setMessages((prevMessages) => {
        const existingMessageIds = new Set(prevMessages.map(m => m._id));
        if (existingMessageIds.has(sentMessage._id)) {
          return prevMessages;
        }
        const updatedMsgs = [...prevMessages, sentMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return updatedMsgs;
      });

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send message.');
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

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const msgDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

    if (msgDay.getTime() === today.getTime()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (msgDay.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else if (now.getFullYear() === messageDate.getFullYear()) {
      return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
        <Header
          title={(() => {
            if (!selectedConversation) {
              return 'Conversations';
            }
            const participantForHeader = selectedConversation?.otherParticipant || selectedConversation;
            return getParticipantDisplayName(participantForHeader, currentUserId);
          })()}
          showBackButton={!!selectedConversation || route.name === 'ChatScreen'}
          onBackPress={() => {
            if (selectedConversation) {
              leaveConversationSocket(selectedConversation.conversationId);
              setSelectedConversation(null);
            } else if (route.name === 'ChatScreen') {
              navigation.goBack();
            }
          }}
          rightComponent={(() => {
            if (!selectedConversation) {
              return null;
            }
            const participantForAvatar = selectedConversation?.otherParticipant || selectedConversation;
            const displayName = getParticipantDisplayName(participantForAvatar, currentUserId);
            return <Avatar text={displayName} size={Spacing.lg} />;
          })()}
        />

        {!selectedConversation ? (
          <ScrollView style={styles.conversationList} contentContainerStyle={styles.conversationListContent}>
            {Object.values(conversations).length > 0 ?
              Object.values(conversations)
                .filter(conv => conv.conversationId && conv.lastMessage && conv.otherParticipant)
                .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt))
                .map((conv) => (
                  <Card key={conv.conversationId} style={styles.conversationCard}>
                    <TouchableOpacity
                      onPress={() => setSelectedConversation(conv)}
                      style={styles.conversationTouchable}
                    >
                      <Avatar text={getParticipantDisplayName(conv.otherParticipant, currentUserId)} size={Spacing.xxl} style={styles.conversationAvatar} />
                      <View style={styles.conversationTextContent}>
                        <Typography variant="h6" style={styles.conversationName}>
                          {getParticipantDisplayName(conv.otherParticipant, currentUserId)}
                        </Typography>
                        <Typography variant="body" style={styles.lastMessage} numberOfLines={1}>
                          {conv.lastMessage.messageText || 'No messages yet.'}
                        </Typography>
                        {conv.unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Typography variant="caption" style={styles.unreadText}>{conv.unreadCount}</Typography>
                          </View>
                        )}
                      </View>
                      <Typography variant="caption" style={styles.conversationTime}>
                        {formatMessageTime(conv.lastMessage.createdAt)}
                      </Typography>
                    </TouchableOpacity>
                  </Card>
                ))
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
                const isRead = msg.read;

                return (
                  <View
                    key={msg._id}
                    style={[
                      styles.messageBubble,
                      isMyMessage ? styles.myMessage : styles.otherMessage
                    ]}
                  >
                    <View style={styles.messageContentWrapper}>
                      <Typography variant="body" style={isMyMessage ? styles.myMessageText : styles.otherMessageText}>
                        {msg.messageText}
                      </Typography>
                      <View style={styles.messageFooter}>
                        <Typography variant="caption" style={isMyMessage ? styles.myMessageTime : styles.otherMessageTime}>
                          {formatMessageTime(msg.createdAt)}
                        </Typography>
                        {isMyMessage && isRead && (
                          <FontAwesome5 name="check-double" size={12} color={Colors.primary100} style={styles.readIcon} />
                        )}
                      </View>
                    </View>
                    {!isMyMessage && (
                      <ReportButton
                        reportedItemId={msg._id}
                        onModel="Message"
                        renderTrigger={({ onPress }) => (
                          <TouchableOpacity onPress={onPress} style={styles.reportTriggerMessage}>
                            <FontAwesome5 name="flag" size={10} color={Colors.neutral400} />
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  </View>
                );
              })
            ) : (
              <Typography variant="body" style={styles.noContentText}>No messages in this conversation yet. Say hello!</Typography>
            )}
            {selectedConversation && typingUsers[selectedConversation.conversationId] &&
              Object.entries(typingUsers[selectedConversation.conversationId]).map(([userId, isTypingStatus]) => {
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
              onChangeText={handleTypingChange}
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
    flexDirection: 'column',
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
    backgroundColor: Colors.primary500,
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
    flexDirection: 'row',
    alignItems: 'flex-end',
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
  messageContentWrapper: {
    flex: 1,
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
  reportTriggerMessage: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
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
    paddingHorizontal: Spacing.md,
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
