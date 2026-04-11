import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  Image,
  TextInput,
  SafeAreaView,
} from 'react-native';
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
} from '../api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgImage } from '../components/common/SvgImage';
import { getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { useAuth } from '../context/AuthContext';

const REPORT_CATEGORIES = [
  'Harassment or bullying',
  'Hate speech',
  'Scam or fraud attempt',
  'Inappropriate content',
  'Spam or solicitation',
  'Threats of violence',
  'Other',
];

// ---- Helpers ----
const getParticipantDisplayName = (entity, currentUserId) => {
  if (!entity) return 'Unknown';
  if (entity.businessName) return entity.businessName;
  if (entity.companyName) return entity.companyName;
  const nameFromFirstLast = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
  if (nameFromFirstLast) return nameFromFirstLast;
  if (entity.name && entity.name !== 'Unknown') return entity.name;
  if (entity.participants && Array.isArray(entity.participants) && currentUserId) {
    const other = entity.participants.find(p => p._id && p._id.toString() !== currentUserId.toString());
    if (other) {
      const name = getParticipantDisplayName(other);
      if (name && name !== 'Unknown') return name;
    }
  }
  if (entity.otherParticipant) {
    const name = getParticipantDisplayName(entity.otherParticipant);
    if (name && name !== 'Unknown') return name;
  }
  if (entity.role?.toLowerCase() === 'contractor') return 'Unknown Contractor';
  if (entity.role?.toLowerCase() === 'user') return 'Unknown User';
  return 'Unknown';
};

function formatRelativeTime(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function formatMessageTime(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (msgDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else if (now.getFullYear() === d.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString();
}

// ---- Conversation List Item ----
const ConversationItem = React.memo(function ConversationItem({ conv, currentUserId, onlineUsers, onPress }) {
  const other = conv.otherParticipant;
  const displayName = getParticipantDisplayName(other, currentUserId);
  const avatarUrl = getProfileImageUrl(displayName, other?.profilePicture || '', other?.category);
  const isOnline = onlineUsers[other?._id] || false;
  const lastMsgText = conv.lastMessage?.messageText || 'No messages yet';
  const lastMsgTime = conv.lastMessage?.createdAt || '';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-neutral-50 dark:bg-neutral-900"
      style={{ gap: 12 }}
    >
      {/* Avatar + online dot */}
      <View className="relative shrink-0">
        {isSvgUrl(avatarUrl) ? (
          <View className="w-[52px] h-[52px] rounded-full overflow-hidden">
            <SvgImage uri={avatarUrl} width="100%" height="100%" />
          </View>
        ) : (
          <Image
            source={{ uri: avatarUrl }}
            className="w-[52px] h-[52px] rounded-full"
          />
        )}
        <View
          className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
            isOnline ? 'bg-emerald-500' : 'bg-neutral-300'
          }`}
        />
      </View>

      {/* Content */}
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center justify-between">
          <Text
            className={`text-sm truncate flex-1 ${
              conv.unreadCount > 0 ? 'font-bold text-neutral-900 dark:text-neutral-50' : 'font-semibold text-neutral-900 dark:text-neutral-50'
            }`}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text className="text-xs text-neutral-400 shrink-0 ml-2">
            {lastMsgTime ? formatRelativeTime(lastMsgTime) : ''}
          </Text>
        </View>
        <Text
          className={`text-sm truncate mt-0.5 ${
            conv.unreadCount > 0 ? 'font-medium text-neutral-900 dark:text-neutral-50' : 'text-neutral-500 dark:text-neutral-400'
          }`}
          numberOfLines={1}
        >
          {lastMsgText}
        </Text>
      </View>

      {/* Unread badge */}
      {conv.unreadCount > 0 && (
        <View className="w-5 h-5 bg-indigo-500 rounded-full items-center justify-center shrink-0">
          <Text className="text-[10px] font-bold text-white dark:text-neutral-900">
            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

// ---- Main Screen ----
const MessagesScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { recipientId, recipientName } = route.params || {};
  const { userId: currentUserId } = useAuth();

  const [conversations, setConversations] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesScrollViewRef = useRef();
  const selectedConversationRef = useRef(selectedConversation);

  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Report/block sheet state
  const [sheetView, setSheetView] = useState(null); // null | 'options' | 'report' | 'block'
  const [reportStep, setReportStep] = useState('category');
  const [reportCategory, setReportCategory] = useState(null);
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Storage ----
  const saveConversationsToStorage = async (convs) => {
    try { await AsyncStorage.setItem('conversations', JSON.stringify(convs)); }
    catch (error) { console.error('Error saving conversations:', error); }
  };

  const loadConversationsFromStorage = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('conversations');
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error loading conversations:', error);
      return null;
    }
  };

  // ---- Ref sync ----
  useEffect(() => { selectedConversationRef.current = selectedConversation; }, [selectedConversation]);

  useEffect(() => {
    if (currentUserId && route.name === 'Messages') {
      loadConversations();
    }
  }, [currentUserId, route.name]);

  // ---- Initialize specific chat (from BusinessDetail) ----
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

          const foundConversation = Object.values(conversationsMap).find(conv =>
            conv.participants.some(p => p._id === recipientId)
          );

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
                { _id: recipientId, name: recipientName, role: 'Contractor' },
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
          Alert.alert('Error', error.message || 'Failed to initialize chat.');
        } finally {
          setLoading(false);
        }
      }
    };
    initializeSpecificChat();
  }, [route.name, recipientId, currentUserId, navigation]);

  // ---- Load conversations on focus ----
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.name === 'Messages' && currentUserId) {
        loadConversations();
        setSelectedConversation(null);
      }
    });
    return unsubscribe;
  }, [navigation, route.name, currentUserId]);

  // ---- Load messages when selecting a conversation ----
  useEffect(() => {
    if (selectedConversation?.conversationId && currentUserId) {
      if (selectedConversation.conversationId?.startsWith('temp-')) {
        setMessages([]);
      } else {
        loadMessages(selectedConversation.conversationId);
      }
    }
  }, [selectedConversation, currentUserId]);

  // ---- Auto-scroll ----
  useEffect(() => {
    if (messagesScrollViewRef.current) {
      messagesScrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // ---- Socket events ----
  useEffect(() => {
    if (!currentUserId) return;
    registerSocket(currentUserId);

    const handleNewMessage = (message) => {
      const senderId = message.senderId?._id;
      const recipientId = message.recipientId?._id;
      if (!senderId || !recipientId) return;
      const currentSelectedConversation = selectedConversationRef.current;

      setConversations((prevConversations) => {
        const convo = prevConversations[message.conversationId] || {
          _id: message.conversationId, participants: [], messages: [],
          lastMessage: null, unreadCount: 0, otherParticipant: null,
        };

        let otherParticipant = convo.otherParticipant;
        if (!otherParticipant || !otherParticipant.name || otherParticipant.name === 'Unknown' || !otherParticipant.role) {
          const rawOther = message.senderId._id === currentUserId ? message.recipientId : message.senderId;
          let displayName = 'Unknown', firstName = '', lastName = '', businessName = '', profilePicture = '';
          let role = rawOther.role || 'User';
          if (role.toLowerCase() === 'user') {
            firstName = rawOther.firstName || '';
            lastName = rawOther.lastName || '';
            displayName = `${firstName} ${lastName}`.trim() || 'Unknown User';
            profilePicture = rawOther.profilePicture || '';
          } else if (role.toLowerCase() === 'contractor') {
            businessName = rawOther.businessName || rawOther.companyName || '';
            displayName = businessName || 'Unknown Contractor';
            profilePicture = rawOther.profilePicture || '';
            firstName = rawOther.firstName || '';
            lastName = rawOther.lastName || '';
          }
          otherParticipant = { _id: rawOther._id, firstName, lastName, businessName, profilePicture, role, name: displayName };
        }

        const updatedMessages = [...convo.messages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const isFromOther = message.senderId._id !== currentUserId;
        const isSelected = currentSelectedConversation && currentSelectedConversation._id === message.conversationId;
        const newUnread = convo.unreadCount + (isFromOther && !isSelected ? 1 : 0);

        return { ...prevConversations, [message.conversationId]: { ...convo, messages: updatedMessages, lastMessage: message, unreadCount: newUnread, otherParticipant } };
      });

      const isForCurrentChat = currentSelectedConversation && currentSelectedConversation._id === message.conversationId;
      if (isForCurrentChat) {
        setMessages((prev) => {
          if (new Set(prev.map(m => m._id)).has(message._id)) return prev;
          return [...prev, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        if (message.recipientId._id === currentUserId && !message.read) {
          emitMessageRead(message._id, currentUserId, message.conversationId);
        }
      }
    };

    const handleMessageRead = ({ messageId, conversationId, readerId }) => {
      setConversations(prev => {
        const updated = { ...prev };
        if (updated[conversationId]) {
          const msgs = updated[conversationId].messages.map(m => m._id === messageId ? { ...m, read: true } : m);
          updated[conversationId] = {
            ...updated[conversationId], messages: msgs,
            lastMessage: updated[conversationId].lastMessage?._id === messageId
              ? { ...updated[conversationId].lastMessage, read: true } : updated[conversationId].lastMessage,
          };
        }
        return updated;
      });
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, read: true } : m));
    };

    const handleTyping = ({ userId, isTyping }) => {
      setTypingUsers(prev => ({
        ...prev,
        [selectedConversationRef.current?.conversationId]: {
          ...prev[selectedConversationRef.current?.conversationId],
          [userId]: isTyping,
        },
      }));
    };

    const handleUserOnlineStatus = ({ userId, isOnline }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: isOnline }));
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

  // ---- Join/leave conversation ----
  useEffect(() => {
    if (selectedConversation?.conversationId && currentUserId) {
      if (!selectedConversation.conversationId?.startsWith('temp-')) {
        joinConversationSocket(selectedConversation.conversationId);
        setConversations(prev => {
          const updated = { ...prev };
          if (updated[selectedConversation.conversationId]) {
            updated[selectedConversation.conversationId] = { ...updated[selectedConversation.conversationId], unreadCount: 0 };
          }
          return updated;
        });
        messages.forEach(msg => {
          if (msg.recipientId && msg.recipientId._id.toString() === currentUserId && !msg.read) {
            emitMessageRead(msg._id, currentUserId, selectedConversation.conversationId);
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

  // ---- Load conversations ----
  const loadConversations = async () => {
    if (!currentUserId) {
      console.log('MessagesScreen: No currentUserId available yet.');
      return;
    }
    setLoading(true);
    try {
      console.log('MessagesScreen: Fetching conversations...');
      let conversationsMap = await loadConversationsFromStorage() || {};
      const apiFetched = await fetchConversations();
      console.log('MessagesScreen: API fetched type:', typeof apiFetched, 'is array:', Array.isArray(apiFetched));
      console.log('MessagesScreen: API fetched count:', apiFetched?.length || 0);

      if (!Array.isArray(apiFetched)) {
        console.warn('MessagesScreen: apiFetched is not an array:', apiFetched);
        setConversations(conversationsMap);
        setLoading(false);
        return;
      }

      apiFetched.forEach(conv => {
        conversationsMap[conv.conversationId] = {
          ...conversationsMap[conv.conversationId], ...conv, _id: conv.conversationId, messages: [],
          fragmentConversationIds: conversationsMap[conv.conversationId]?.fragmentConversationIds || [],
        };
        const other = conv.participants.find(p => p._id && currentUserId && p._id.toString() !== currentUserId.toString());
        if (other) {
          const details = {
            _id: other._id, firstName: other.firstName || '', lastName: other.lastName || '',
            businessName: other.businessName || '', companyName: other.companyName || '',
            profilePicture: other.profilePicture || '',
            role: (other.businessName || other.companyName) ? 'Contractor' : (other.role || 'User'),
          };
          details.name = getParticipantDisplayName(details, currentUserId);
          conversationsMap[conv.conversationId].otherParticipant = details;
        }
      });

      for (const convId in conversationsMap) {
        if (!apiFetched.some(fc => fc.conversationId === convId)) delete conversationsMap[convId];
      }

      // Deduplicate conversations by same other participant
      const groups = Object.values(conversationsMap).reduce((acc, convo) => {
        const other = convo.participants.find(p => p._id && currentUserId && p._id.toString() !== currentUserId.toString());
        if (other) {
          const otherId = other._id.toString();
          acc[otherId] = acc[otherId] || [];
          acc[otherId].push(convo);
        }
        return acc;
      }, {});

      Object.entries(groups).forEach(([, convos]) => {
        if (convos.length > 1) {
          const canonical = convos.reduce((keep, c) =>
            new Date(c.lastMessage?.createdAt || 0) < new Date(keep.lastMessage?.createdAt || 0) ? c : keep
          );
          const fragmentIds = convos.filter(c => c.conversationId !== canonical.conversationId).map(c => c.conversationId);
          conversationsMap[canonical.conversationId] = { ...canonical, fragmentConversationIds: [...(canonical.fragmentConversationIds || []), ...fragmentIds], messages: [] };
          fragmentIds.forEach(id => { delete conversationsMap[id]; });
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

  // ---- Load messages ----
  const loadMessages = async (conversationId) => {
    setLoading(true);
    try {
      const fetchedMessages = await fetchMessages(conversationId);
      const sorted = fetchedMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(sorted);
      setConversations(prev => {
        const updated = { ...prev };
        if (updated[conversationId]) {
          updated[conversationId] = { ...updated[conversationId], messages: sorted, unreadCount: 0 };
        }
        saveConversationsToStorage(updated);
        return updated;
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Send message ----
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return;
    try {
      let finalConversationId = selectedConversation.conversationId;
      let targetRecipientId;

      if (selectedConversation.conversationId?.startsWith('temp-')) {
        const { conversationId: newConvoId, participants: newConvoParticipants } = await createConversation([currentUserId, recipientId]);
        finalConversationId = newConvoId;
        const rawOther = newConvoParticipants.find(p => p._id && p._id.toString() !== currentUserId.toString());
        let processed = {
          _id: rawOther._id, firstName: rawOther.firstName || '', lastName: rawOther.lastName || '',
          businessName: rawOther.businessName || rawOther.companyName || '',
          profilePicture: rawOther.profilePicture || '',
          role: (rawOther.businessName || rawOther.companyName) ? 'Contractor' : (rawOther.role || 'User'),
        };
        processed.name = getParticipantDisplayName(processed, currentUserId);
        setSelectedConversation(prev => ({ ...prev, _id: newConvoId, conversationId: newConvoId, otherParticipant: processed, participants: newConvoParticipants }));
        setConversations(prev => {
          const updated = { ...prev, [newConvoId]: { _id: newConvoId, conversationId: newConvoId, participants: newConvoParticipants, otherParticipant: processed, messages: [], lastMessage: null, unreadCount: 0 } };
          if (selectedConversation.conversationId?.startsWith('temp-')) delete updated[selectedConversation.conversationId];
          return updated;
        });
        joinConversationSocket(finalConversationId);
        targetRecipientId = processed._id;
      } else {
        const other = selectedConversation.participants.find(p => p._id && p._id.toString() !== currentUserId.toString());
        targetRecipientId = other?._id;
      }

      if (!targetRecipientId) { Alert.alert('Error', 'Could not determine recipient.'); return; }

      const sentMessage = await sendMessage(finalConversationId, targetRecipientId, newMessage);
      setNewMessage('');
      emitTyping(finalConversationId, currentUserId, false);

      setConversations(prev => {
        const currentConvo = prev[sentMessage.conversationId] || {
          _id: sentMessage.conversationId, conversationId: sentMessage.conversationId,
          participants: [], messages: [], lastMessage: null, unreadCount: 0, otherParticipant: null,
        };
        let otherParticipant = currentConvo.otherParticipant;
        if (!otherParticipant || !otherParticipant.name || otherParticipant.name === 'Unknown') {
          const rawOther = sentMessage.senderId._id === currentUserId ? sentMessage.recipientId : sentMessage.senderId;
          let displayName = 'Unknown', firstName = '', lastName = '', businessName = '', profilePicture = '';
          let role = rawOther.role || 'User';
          if (role === 'User') {
            firstName = rawOther.firstName || ''; lastName = rawOther.lastName || '';
            displayName = `${firstName} ${lastName}`.trim() || 'Unknown User';
            profilePicture = rawOther.profilePicture || '';
          } else if (role === 'Contractor') {
            businessName = rawOther.businessName || '';
            displayName = businessName || 'Unknown Contractor';
            profilePicture = rawOther.profilePicture || '';
            firstName = rawOther.firstName || ''; lastName = rawOther.lastName || '';
          }
          otherParticipant = { _id: rawOther._id, firstName, lastName, businessName, profilePicture, role, name: displayName };
        }
        const updatedMsgs = [...currentConvo.messages];
        if (!updatedMsgs.some(m => m._id === sentMessage._id)) updatedMsgs.push(sentMessage);
        updatedMsgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return { ...prev, [sentMessage.conversationId]: { ...currentConvo, messages: updatedMsgs, lastMessage: sentMessage, otherParticipant, unreadCount: 0 } };
      });

      setMessages(prev => {
        if (new Set(prev.map(m => m._id)).has(sentMessage._id)) return prev;
        return [...prev, sentMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send message.');
    }
  };

  // ---- Typing handler ----
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

  // ---- Filtered conversations for search ----
  const filteredConversations = useMemo(() => {
    const allConvs = Object.values(conversations)
      .filter(conv => conv.conversationId && conv.lastMessage && conv.otherParticipant)
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    if (!searchQuery.trim()) return allConvs;
    const q = searchQuery.toLowerCase();
    return allConvs.filter(c => {
      const name = getParticipantDisplayName(c.otherParticipant, currentUserId).toLowerCase();
      const lastMsg = (c.lastMessage?.messageText || '').toLowerCase();
      return name.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchQuery, currentUserId]);

  const totalUnread = Object.values(conversations).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  // ---- Report/block handlers ----
  const closeSheet = () => { setSheetView(null); setReportStep('category'); setReportCategory(null); setReportDetails(''); setIsSubmitting(false); };

  const handleReportSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => { setIsSubmitting(false); setReportStep('success'); }, 800);
  };

  const handleBlockUser = () => { closeSheet(); };

  // ---- Get other participant info for chat view ----
  const chatOtherParticipant = selectedConversation?.otherParticipant || selectedConversation;
  const chatDisplayName = getParticipantDisplayName(chatOtherParticipant, currentUserId);
  const chatAvatarUrl = getProfileImageUrl(chatDisplayName, chatOtherParticipant?.profilePicture || '', chatOtherParticipant?.category);
  const chatIsOnline = onlineUsers[chatOtherParticipant?._id] || false;
  const isOtherTyping = selectedConversation && typingUsers[selectedConversation.conversationId]
    ? Object.entries(typingUsers[selectedConversation.conversationId]).some(([uid, typing]) => uid !== currentUserId && typing)
    : false;

  // ---- Loading state ----
  if (loading && !selectedConversation) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a3a3a3" />
        <Text className="text-sm text-neutral-400 mt-3">Loading conversations...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-neutral-950"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View className="flex-1 bg-white dark:bg-neutral-950" style={{ paddingTop: Math.max(insets.top, 16) }}>
        {/* ============ CONVERSATION LIST VIEW ============ */}
        {!selectedConversation && route.name !== 'ChatScreen' ? (
        <View className="flex-1 bg-white dark:bg-neutral-950">
          {/* Header */}
          <View className="px-4 pb-2">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Messages</Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {totalUnread > 0
                ? `You have ${totalUnread} unread message${totalUnread > 1 ? 's' : ''}`
                : 'All caught up!'}
            </Text>
          </View>

          {/* Search */}
          <View className="px-4 pb-3">
            <View className="relative">
              <FontAwesome5 name="search" size={14} color="#a3a3a3" style={{ position: 'absolute', left: 12, top: 13, zIndex: 1 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search messages..."
                placeholderTextColor="#a3a3a3"
                className="w-full bg-neutral-100 dark:bg-neutral-900 rounded-full pl-10 pr-4 py-2.5 text-sm"
              />
            </View>
          </View>

          {/* Conversation List */}
          {filteredConversations.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-full items-center justify-center mb-4">
                <FontAwesome5 name="comment" size={28} color="#d4d4d4" />
              </View>
              <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                {searchQuery ? 'No matches found' : 'No messages yet'}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center">
                {searchQuery ? 'Try a different search term' : 'Start a conversation with a contractor'}
              </Text>
            </View>
          ) : (
            <ScrollView className="flex-1">
              <View className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredConversations.map(conv => (
                  <ConversationItem
                    key={conv.conversationId}
                    conv={conv}
                    currentUserId={currentUserId}
                    onlineUsers={onlineUsers}
                    onPress={() => setSelectedConversation(conv)}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      ) : (
        /* ============ CHAT VIEW ============ */
        <View className="flex-1 bg-white dark:bg-neutral-950">
          {/* Chat Header */}
          <View className="bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex-row items-center" style={{ gap: 12 }}>
            <Pressable
              onPress={() => {
                if (selectedConversation) {
                  leaveConversationSocket(selectedConversation.conversationId);
                  setSelectedConversation(null);
                } else if (route.name === 'ChatScreen') {
                  navigation.goBack();
                }
              }}
              className="w-8 h-8 items-center justify-center"
            >
              <FontAwesome5 name="chevron-left" size={18} color="#171717" />
            </Pressable>

            <View className="relative shrink-0">
              {isSvgUrl(chatAvatarUrl) ? (
                <View className="w-9 h-9 rounded-full overflow-hidden">
                  <SvgImage uri={chatAvatarUrl} width="100%" height="100%" />
                </View>
              ) : (
                <Image
                  source={{ uri: chatAvatarUrl }}
                  className="w-9 h-9 rounded-full"
                />
              )}
              <View className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${chatIsOnline ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
            </View>

            <View className="flex-1 min-w-0">
              <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50" numberOfLines={1}>{chatDisplayName}</Text>
              <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isOtherTyping ? 'typing...' : chatIsOnline ? 'Online' : 'Offline'}
              </Text>
            </View>

            <Pressable
              onPress={() => setSheetView('options')}
              className="w-8 h-8 items-center justify-center rounded-full"
            >
              <FontAwesome5 name="ellipsis-v" size={16} color="#525252" />
            </Pressable>
          </View>

          {/* Security banner */}
          <View className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 px-4 py-2">
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
              Connected — messages are end-to-end encrypted
            </Text>
          </View>

          {/* Messages */}
          <ScrollView
            ref={messagesScrollViewRef}
            className="flex-1 px-4 py-4"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            onContentSizeChange={() => messagesScrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {loading ? (
              <View className="flex-1 items-center justify-center py-20">
                <ActivityIndicator size="small" color="#d4d4d4" />
                <Text className="text-sm text-neutral-400 ml-2 mt-2">Loading messages...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View className="flex-1 items-center justify-center">
                <View className="w-14 h-14 bg-neutral-100 dark:bg-neutral-900 rounded-full items-center justify-center mb-3">
                  <FontAwesome5 name="comment" size={24} color="#d4d4d4" />
                </View>
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">No messages yet</Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Say hello to start the conversation!</Text>
              </View>
            ) : (
              messages.map(msg => {
                const isMe = currentUserId && msg.senderId && msg.senderId._id === currentUserId;
                const senderPic = msg.senderId?.profilePicture || '';

                return (
                  <View key={msg._id} className={`flex-row mb-3 ${isMe ? 'justify-end' : 'justify-start'}`} style={{ gap: 8 }}>
                    {!isMe && (
                      <Image
                        source={{ uri: senderPic || chatAvatarUrl || 'https://ui-avatars.com/api/?name=U' }}
                        className="w-6 h-6 rounded-full mt-auto"
                      />
                    )}
                    <View className="max-w-[75%]">
                      <View
                        className={`px-3.5 py-2.5 rounded-2xl ${
                          isMe
                            ? 'bg-neutral-900 dark:bg-neutral-50 rounded-br-md'
                            : 'bg-neutral-100 dark:bg-neutral-900 rounded-bl-md'
                        }`}
                      >
                        <Text className={`text-sm leading-relaxed ${isMe ? 'text-white dark:text-neutral-900' : 'text-neutral-900 dark:text-neutral-50'}`}>
                          {msg.messageText}
                        </Text>
                      </View>
                      <View className={`flex-row items-center mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`} style={{ gap: 4 }}>
                        <Text className="text-[10px] text-neutral-400">
                          {formatRelativeTime(msg.createdAt)}
                        </Text>
                        {isMe && msg.read && (
                          <FontAwesome5 name="check-double" size={10} color="#3b82f6" />
                        )}
                        {isMe && !msg.read && (
                          <FontAwesome5 name="check" size={10} color="#d4d4d4" />
                        )}
                      </View>
                    </View>
                    {isMe && (
                      <Image
                        source={{ uri: currentUserId ? '' : '' }}
                        className="w-6 h-6 rounded-full mt-auto bg-neutral-200 dark:bg-neutral-800"
                      />
                    )}
                  </View>
                );
              })
            )}

            {/* Typing indicator */}
            {isOtherTyping && (
              <View className="flex-row justify-start mb-3" style={{ gap: 8 }}>
                <Image
                  source={{ uri: chatAvatarUrl || 'https://ui-avatars.com/api/?name=U' }}
                  className="w-6 h-6 rounded-full mt-auto"
                />
                <View className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl rounded-bl-md px-4 py-3 flex-row items-center" style={{ gap: 4 }}>
                  <View className="w-2 h-2 bg-neutral-400 rounded-full" />
                  <View className="w-2 h-2 bg-neutral-400 rounded-full" />
                  <View className="w-2 h-2 bg-neutral-400 rounded-full" />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Bar */}
          <View className="bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-700 px-3 py-2">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <TextInput
                value={newMessage}
                onChangeText={handleTypingChange}
                placeholder="Type a message..."
                placeholderTextColor="#a3a3a3"
                className="flex-1 bg-neutral-100 dark:bg-neutral-900 rounded-full px-4 py-2.5 text-sm"
              />
              <Pressable
                onPress={handleSendMessage}
                disabled={!newMessage.trim()}
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  newMessage.trim() ? 'bg-neutral-900 dark:bg-neutral-50' : 'bg-neutral-200 dark:bg-neutral-800'
                }`}
              >
                <FontAwesome5 name="paper-plane" size={14} color={newMessage.trim() ? '#fff' : '#a3a3a3'} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ============ OPTIONS SHEET ============ */}
      {sheetView === 'options' && (
        <View className="absolute inset-0 z-[60] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={closeSheet} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-2xl">
            <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto mt-3" />
            <View className="px-5 pt-4 pb-2 items-center">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">Options</Text>
            </View>
            <View className="px-4 pb-2" style={{ gap: 4 }}>
              <Pressable
                onPress={() => { setSheetView('report'); setReportStep('category'); }}
                className="flex-row items-center px-4 py-3.5 rounded-xl" style={{ gap: 12 }}
              >
                <View className="w-9 h-9 rounded-full bg-amber-50 items-center justify-center">
                  <FontAwesome5 name="flag" size={14} color="#d97706" />
                </View>
                <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50 flex-1">Report User</Text>
                <FontAwesome5 name="chevron-right" size={14} color="#a3a3a3" />
              </Pressable>
              <Pressable
                onPress={() => setSheetView('block')}
                className="flex-row items-center px-4 py-3.5 rounded-xl" style={{ gap: 12 }}
              >
                <View className="w-9 h-9 rounded-full bg-indigo-50 items-center justify-center">
                  <FontAwesome5 name="ban" size={14} color="#6366f1" />
                </View>
                <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50 flex-1">Block User</Text>
                <FontAwesome5 name="chevron-right" size={14} color="#a3a3a3" />
              </Pressable>
            </View>
            <View className="px-4 pb-6 pt-2 items-center">
              <Pressable onPress={closeSheet} className="py-3">
                <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ============ BLOCK SHEET ============ */}
      {sheetView === 'block' && (
        <View className="absolute inset-0 z-[60] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={closeSheet} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-2xl px-6 pt-6 pb-6">
            <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto absolute top-3 left-1/2 -ml-5" />
            <View className="w-12 h-12 rounded-full bg-indigo-50 items-center justify-center mx-auto mb-4">
              <FontAwesome5 name="shield-alt" size={22} color="#6366f1" />
            </View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 text-center">Block this user?</Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mt-2 leading-5 px-2">
              They won't be able to message you or see your profile. You can unblock them later in Settings.
            </Text>
            <View className="mt-6" style={{ gap: 12 }}>
              <Pressable onPress={handleBlockUser} className="w-full py-3.5 rounded-xl bg-indigo-500 items-center">
                <Text className="text-sm font-semibold text-white dark:text-neutral-900">Block</Text>
              </Pressable>
              <Pressable onPress={closeSheet} className="w-full py-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 items-center">
                <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ============ REPORT SHEET — CATEGORY ============ */}
      {sheetView === 'report' && reportStep === 'category' && (
        <View className="absolute inset-0 z-[60] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={closeSheet} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-2xl max-h-[85vh]">
            <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto mt-3" />
            <View className="px-5 pt-4 pb-1">
              <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Report this conversation</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Help us understand what happened</Text>
            </View>
            <ScrollView className="px-4 py-3" style={{ gap: 4 }}>
              {REPORT_CATEGORIES.map(cat => {
                const isSelected = reportCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setReportCategory(cat)}
                    className={`flex-row items-center px-4 py-3.5 rounded-xl ${isSelected ? 'bg-neutral-900 dark:bg-neutral-50' : ''}`}
                    style={{ gap: 12 }}
                  >
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center shrink-0 ${isSelected ? 'border-white' : 'border-neutral-300'}`}>
                      {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-white dark:bg-neutral-950" />}
                    </View>
                    <Text className={`text-sm font-medium ${isSelected ? 'text-white dark:text-neutral-900' : 'text-neutral-900 dark:text-neutral-50'}`}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="px-5 pb-6 pt-2">
              <Pressable
                disabled={!reportCategory}
                onPress={() => setReportStep('details')}
                className={`w-full py-3.5 rounded-xl items-center ${reportCategory ? 'bg-neutral-900 dark:bg-neutral-50' : 'bg-neutral-200 dark:bg-neutral-800'}`}
              >
                <Text className={`text-sm font-semibold ${reportCategory ? 'text-white dark:text-neutral-900' : 'text-neutral-400'}`}>Next</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ============ REPORT SHEET — DETAILS ============ */}
      {sheetView === 'report' && reportStep === 'details' && (
        <View className="absolute inset-0 z-[60] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={closeSheet} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-2xl">
            <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto mt-3" />
            <View className="px-5 pt-4 pb-1 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Tell us more</Text>
              <Pressable onPress={closeSheet} className="w-8 h-8 items-center justify-center rounded-full">
                <FontAwesome5 name="times" size={14} color="#737373" />
              </Pressable>
            </View>
            <Text className="px-5 text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Selected: <Text className="font-medium text-neutral-700 dark:text-neutral-300">{reportCategory}</Text>
            </Text>
            <View className="px-5 pt-4 pb-4">
              <TextInput
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="Add any additional details (optional)..."
                placeholderTextColor="#a3a3a3"
                multiline
                numberOfLines={5}
                className="w-full bg-neutral-50 dark:bg-neutral-900 rounded-xl px-4 py-3 text-sm text-neutral-900 dark:text-neutral-50"
                style={{ textAlignVertical: 'top', minHeight: 120 }}
              />
            </View>
            <View className="px-5 pb-6" style={{ gap: 12 }}>
              <Pressable
                onPress={handleReportSubmit}
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-neutral-900 dark:bg-neutral-50 items-center flex-row justify-center"
                style={{ gap: 8, opacity: isSubmitting ? 0.6 : 1 }}
              >
                {isSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-sm font-semibold text-white dark:text-neutral-900">Submitting...</Text>
                  </>
                ) : (
                  <Text className="text-sm font-semibold text-white dark:text-neutral-900">Submit Report</Text>
                )}
              </Pressable>
              <Pressable onPress={closeSheet} className="py-2 items-center">
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ============ REPORT SHEET — SUCCESS ============ */}
      {sheetView === 'report' && reportStep === 'success' && (
        <View className="absolute inset-0 z-[60] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={closeSheet} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-2xl px-6 pt-8 pb-8 items-center">
            <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto absolute top-3 left-1/2 -ml-5" />
            <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-5">
              <FontAwesome5 name="check-circle" size={32} color="#10b981" />
            </View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 text-center">Report submitted</Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mt-2 leading-5 max-w-[260px]">
              We'll review this conversation within 24 hours. We'll take action if needed.
            </Text>
            <Pressable
              onPress={closeSheet}
              className="mt-6 w-full max-w-[240px] py-3.5 rounded-xl bg-neutral-900 dark:bg-neutral-50 items-center"
            >
              <Text className="text-sm font-semibold text-white dark:text-neutral-900">Done</Text>
            </Pressable>
          </View>
        </View>
      )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default MessagesScreen;
