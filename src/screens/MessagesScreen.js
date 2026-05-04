import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageLightbox from "../components/ImageLightbox";
import * as ImagePicker from "expo-image-picker";
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  createConversation, extractId,
  registerSocket,
  joinConversationSocket,
  leaveConversationSocket,
  onNewMessage, offNewMessage,
  onMessageRead, offMessageRead,
  onTyping, offTyping,
  onUserOnlineStatus, offUserOnlineStatus,
  emitTyping,
  emitMessageRead,
} from "../api";
import { useAuth } from "../context/AuthContext";
import { SvgImage } from "../components/common/SvgImage";
import { getProfileImageUrl, isSvgUrl } from "../utils/avatarUtils";

const REPORT_CATEGORIES = [
  "Harassment or bullying",
  "Hate speech",
  "Scam or fraud attempt",
  "Inappropriate content",
  "Spam or solicitation",
  "Threats of violence",
  "Other",
];

// ---- Helpers ----
const getParticipantDisplayName = (entity, currentUserId) => {
  if (!entity) return 'Unknown';
  const nameFromFirstLast = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
  if (nameFromFirstLast) return nameFromFirstLast;
  if (entity.contactPerson) return entity.contactPerson;
  if (entity.name && entity.name !== 'Unknown') return entity.name;
  if (entity.businessName) return entity.businessName;
  if (entity.companyName) return entity.companyName;
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

// ---- Conversation List Item ----
const ConversationItem = React.memo(function ConversationItem({ conv, currentUserId, onlineUsers, onPress }) {
  const other = conv.otherParticipant;
  const displayName = getParticipantDisplayName(other, currentUserId);
  const avatarUrl = getProfileImageUrl(displayName, other?.profilePicture || '', other?.category);
  const isOnline = onlineUsers[other?._id] || false;
  const lastMsgText = conv.lastMessage?.messageText || (conv.lastMessage?.attachmentUrl ? ((/\.(jpg|jpeg|png|gif|webp)$/i.test(conv.lastMessage.attachmentUrl)) ? "📷 Photo" : "📎 Attachment") : (conv.lastMessage?.type === "quote" ? "📄 Quote" : "No messages yet"));
  const lastMsgTime = conv.lastMessage?.createdAt || '';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-neutral-50 dark:bg-neutral-900"
      style={{ gap: 12 }}
    >
      <View className="relative shrink-0">
        {isSvgUrl(avatarUrl) ? (
          <View className="w-[52px] h-[52px] rounded-full overflow-hidden">
            <SvgImage uri={avatarUrl} width="100%" height="100%" />
          </View>
        ) : (
          <Image source={{ uri: avatarUrl }} className="w-[52px] h-[52px] rounded-full" />
        )}
        <View className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate flex-1" numberOfLines={1}>{displayName}</Text>
          <Text className="text-xs text-neutral-400 shrink-0 ml-2">{lastMsgTime ? formatRelativeTime(lastMsgTime) : ''}</Text>
        </View>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 truncate mt-0.5" numberOfLines={1}>{lastMsgText}</Text>
      </View>
      {conv.unreadCount > 0 && (
        <View className="w-5 h-5 bg-indigo-500 rounded-full items-center justify-center shrink-0">
          <Text className="text-[10px] font-bold text-white dark:text-neutral-900">{conv.unreadCount > 9 ? '9+' : conv.unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
});

const MessagesScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { recipientId, recipientName, conversationId: routeConversationId } = route.params || {};
  const { userId: currentUserId, userRole: role } = useAuth();
  if (__DEV__) console.log('MessagesScreen: Current Role:', role);

  const [conversations, setConversations] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Auto-select conversation if conversationId or recipientId is provided in route params
  useEffect(() => {
    if (routeConversationId && conversations[routeConversationId]) {
      setSelectedConversation(conversations[routeConversationId]);
    } else if (routeConversationId && !conversations[routeConversationId]) {
      // If we have a route ID but it's not in our list yet, create a placeholder
      setSelectedConversation({ conversationId: routeConversationId, _id: routeConversationId, participants: [], messages: [] });
    } else if (recipientId && !routeConversationId) {
      // If we only have a recipientId, check if a conversation already exists
      const existingConv = Object.values(conversations).find(c => extractId(c.otherParticipant) === recipientId);
      if (existingConv) {
        setSelectedConversation(existingConv);
      } else {
        // Create a temp conversation to allow sending the first message
        setSelectedConversation({
          conversationId: `temp-${recipientId}`,
          _id: `temp-${recipientId}`,
          otherParticipant: { _id: recipientId, firstName: recipientName },
          participants: [],
          messages: []
        });
      }
    }
  }, [routeConversationId, recipientId, recipientName, conversations]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [activeImage, setActiveImage] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const messagesScrollViewRef = useRef();
  const selectedConversationRef = useRef(null);

  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetView, setSheetView] = useState(null);
  const [reportStep, setReportStep] = useState('category');
  const [reportCategory, setReportCategory] = useState(null);
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPendingAttachment(result.assets[0]);
    }
  };

  useEffect(() => { selectedConversationRef.current = selectedConversation; }, [selectedConversation]);

  useEffect(() => {
    if (!currentUserId) return;
    const handleNewMessage = (message) => {
      setConversations(prev => {
        const convo = prev[message.conversationId] || { conversationId: message.conversationId, _id: message.conversationId, participants: [], messages: [], lastMessage: null, unreadCount: 0, otherParticipant: null };
        const existingMessages = convo.messages || [];
        if (existingMessages.some(m => m._id === message._id)) return prev;
        const updatedMessages = [...existingMessages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const senderId = extractId(message.senderId);
        const otherId = extractId(convo.otherParticipant);
        const isFromOther = (() => {
          if (!senderId) return false;
          return currentUserId && senderId.toString() !== currentUserId.toString();
        })();
        const isSelected = selectedConversationRef.current && (selectedConversationRef.current.conversationId === message.conversationId || selectedConversationRef.current._id === message.conversationId);
        const newUnread = convo.unreadCount + (isFromOther && !isSelected ? 1 : 0);
        return { ...prev, [message.conversationId]: { ...convo, messages: updatedMessages, lastMessage: message, unreadCount: newUnread } };
      });

      const isForCurrentChat = selectedConversationRef.current && (selectedConversationRef.current.conversationId === message.conversationId || selectedConversationRef.current._id === message.conversationId);
      if (isForCurrentChat) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        if (extractId(message.recipientId) === extractId(currentUserId) && !message.read) {
          emitMessageRead(message._id, currentUserId, message.conversationId);
        }
      }
    };

    const setupSocket = async () => {
      await registerSocket(currentUserId);
      onNewMessage(handleNewMessage);
      onUserOnlineStatus(({ userId, isOnline }) => setOnlineUsers(prev => ({ ...prev, [userId]: isOnline })));
    };
    setupSocket();

    return () => {
      offNewMessage(handleNewMessage);
      leaveConversationSocket(selectedConversationRef.current?._id);
    };
  }, [currentUserId]);

  const loadConversations = async () => {
    if (!currentUserId) return;
    // Only show spinner on first load, not on refreshes (keep stale data visible)
    if (Object.keys(conversations).length === 0) setLoading(true);
    try {
      const apiFetched = await fetchConversations();
      if (Array.isArray(apiFetched)) {
        const conversationsMap = apiFetched.reduce((acc, conv) => {
          acc[conv.conversationId] = { ...conv, _id: conv.conversationId };
          const other = conv.participants.find(p => extractId(p) !== currentUserId);
          if (other) acc[conv.conversationId].otherParticipant = other;
          return acc;
        }, {});
        setConversations(conversationsMap);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (currentUserId) loadConversations(); }, [currentUserId]);

  const loadMessages = async (conversationId) => {
    setLoading(true);
    try {
      const data = await fetchMessages(conversationId);
      const msgs = Array.isArray(data) ? data : data?.messages || [];
      setMessages([...msgs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedConversation?.conversationId) {
      if (selectedConversation.conversationId.startsWith('temp-')) setMessages([]);
      else loadMessages(selectedConversation.conversationId);
    }
  }, [selectedConversation]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !pendingAttachment) || !selectedConversation || !currentUserId) return;
    try {
      let finalConversationId = selectedConversation.conversationId || selectedConversation._id;
      let targetRecipientId = extractId(selectedConversation.otherParticipant);

      if (finalConversationId?.startsWith('temp-')) {
        const response = await createConversation([currentUserId, targetRecipientId]);
        finalConversationId = response.conversationId;
      }

      let attachmentUrl = undefined;
      if (pendingAttachment) {
        setIsUploading(true);
        try {
          const { uploadToCloudinary, CLOUDINARY_FOLDERS } = require('../utils/cloudinary');
          attachmentUrl = await uploadToCloudinary(pendingAttachment.uri, CLOUDINARY_FOLDERS.CHAT);
        } catch (uploadErr) {
          setIsUploading(false);
          Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
          return;
        }
        setIsUploading(false);
      }

      const sentMessage = await sendMessage(finalConversationId, targetRecipientId, newMessage, attachmentUrl);
      setNewMessage('');
      setPendingAttachment(null);
      
      // Update selected conversation id if it was temporary
      if (selectedConversation.conversationId !== finalConversationId) {
        setSelectedConversation(prev => ({ ...prev, conversationId: finalConversationId, _id: finalConversationId }));
      }

      setConversations(prev => {
        const convo = prev[sentMessage.conversationId] || { conversationId: sentMessage.conversationId, _id: sentMessage.conversationId, participants: [], messages: [], lastMessage: null, unreadCount: 0, otherParticipant: selectedConversation.otherParticipant };
        return { ...prev, [sentMessage.conversationId]: { ...convo, lastMessage: sentMessage, messages: [...(convo.messages || []), sentMessage] } };
      });

      setMessages(prev => {
        if (prev.some(m => m._id === sentMessage._id)) return prev;
        return [...prev, sentMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const filteredConversations = useMemo(() => {
    return Object.values(conversations)
      .filter(c => c.lastMessage)
      .filter(c => !searchQuery || getParticipantDisplayName(c.otherParticipant, currentUserId).toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  }, [conversations, searchQuery, currentUserId]);

  const chatOtherParticipant = selectedConversation?.otherParticipant;
  const chatDisplayName = getParticipantDisplayName(chatOtherParticipant, currentUserId) || recipientName || 'Chat';
  const chatAvatarUrl = getProfileImageUrl(chatDisplayName, chatOtherParticipant?.profilePicture || route.params?.recipientImage || '');
  const chatIsOnline = onlineUsers[extractId(chatOtherParticipant)] || false;

  const closeSheet = () => { setSheetView(null); setReportStep('category'); setReportCategory(null); };

  if (loading && !selectedConversation && route.name === 'ChatScreen') {
    return <View className="flex-1 bg-white items-center justify-center"><ActivityIndicator size="large" color="#4F46E5" /></View>;
  }

  const showChatView = selectedConversation || route.name === 'ChatScreen';

  return (
    <KeyboardAvoidingView className="flex-1 bg-white dark:bg-neutral-950" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {!showChatView ? (
          <View className="flex-1">
            <View className="px-4 py-2"><Text className="text-2xl font-bold">Messages</Text></View>
            <View className="px-4 pb-3">
              <View className="bg-neutral-100 dark:bg-neutral-900 rounded-full px-4 py-2 flex-row items-center">
                <FontAwesome5 name="search" size={14} color="#a3a3a3" />
                <TextInput className="flex-1 ml-2 text-sm" placeholder="Search messages..." value={searchQuery} onChangeText={setSearchQuery} />
              </View>
            </View>
            <ScrollView className="flex-1">
              {filteredConversations.map((conv, idx) => (
                <ConversationItem key={conv.conversationId || conv._id || `c-${idx}`} conv={conv} currentUserId={currentUserId} onlineUsers={onlineUsers} onPress={() => setSelectedConversation(conv)} />
              ))}
            </ScrollView>
          </View>
        ) : (
          <View className="flex-1">
            {/* Chat Header */}
            <View className="px-4 py-3 border-b border-neutral-200 flex-row items-center" style={{ gap: 12 }}>
              <Pressable onPress={() => {
                if (route.name === 'ChatScreen') navigation.goBack();
                else setSelectedConversation(null);
              }}><FontAwesome5 name="chevron-left" size={18} color="#171717" /></Pressable>
              <Image source={{ uri: chatAvatarUrl }} className="w-9 h-9 rounded-full" />
              <View className="flex-1">
                <Text className="text-sm font-bold truncate" numberOfLines={1}>{chatDisplayName}</Text>
                <Text className="text-[11px] text-neutral-500">{chatIsOnline ? 'Online' : 'Offline'}</Text>
              </View>
              <Pressable onPress={() => setSheetView('options')}><FontAwesome5 name="ellipsis-v" size={16} color="#525252" /></Pressable>
            </View>

            {/* Messages */}
            <ScrollView 
              ref={messagesScrollViewRef} 
              className="flex-1 px-4 py-4"
              onContentSizeChange={() => messagesScrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((msg, idx) => {
                const isMe = (() => {
                  const sId = extractId(msg.senderId);
                  const rId = extractId(msg.recipientId);
                  const myId = currentUserId?.toString();
                  const oId = extractId(chatOtherParticipant);

                  // 1. Direct ID comparison (User ID vs User ID)
                  if (sId && myId && sId === myId) return true;
                  if (rId && oId && rId === oId) return true;
                  if (sId && oId && sId === oId) return false;
                  if (rId && myId && rId === myId) return false;

                  // 2. Role-based fallback (for Contractor ID mismatch in unpatched Production API)
                  const myRole = role?.toLowerCase();
                  const oRole = chatOtherParticipant?.role?.toLowerCase();
                  const sModel = msg.senderOnModel?.toLowerCase();

                  if (sModel === 'contractor') {
                    if (myRole === 'contractor' && oRole !== 'contractor') return true;
                    if (oRole === 'contractor' && myRole !== 'contractor') return false;
                  } else if (sModel === 'user') {
                    if (myRole === 'user' && oRole !== 'user') return true;
                    if (oRole === 'user' && myRole !== 'user') return false;
                  }

                  return false;
                })();
                return (
                  <View key={msg._id || msg.id || `m-${idx}`} className={`flex-row mb-3 ${isMe ? 'justify-end' : 'justify-start'}`} style={{ gap: 8 }}>
                    <View className="max-w-[80%]">
                      <View className={`px-3.5 py-2.5 rounded-2xl ${isMe ? 'bg-indigo-600' : 'bg-neutral-100'}`}>
                        {msg.type === "quote" && msg.quote && (
                          <View className="bg-white rounded-xl p-3 mb-2 border border-neutral-100">
                            <Text className="text-xs font-bold text-indigo-600 mb-1">PROJECT QUOTE</Text>
                            <Text className="text-sm font-bold">{msg.quote.projectName}</Text>
                            <Text className="text-sm font-bold mt-1">${(msg.quote.total || 0).toLocaleString()}</Text>
                          </View>
                        )}
                        {msg.attachmentUrl && (/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachmentUrl)) ? (
                          <Pressable onPress={() => { setActiveImage(msg.attachmentUrl); setLightboxVisible(true); }}>
                            <Image source={{ uri: msg.attachmentUrl }} style={{ width: 200, height: 150, borderRadius: 8, marginBottom: 4 }} resizeMode="cover" />
                          </Pressable>
                        ) : msg.attachmentUrl && (
                          <View className="bg-black/5 p-2 rounded-lg mb-1 flex-row items-center">
                            <FontAwesome5 name="paperclip" size={12} />
                            <Text className="text-xs ml-2 underline">View Attachment</Text>
                          </View>
                        )}
                        <Text className={`text-sm ${isMe ? 'text-white' : 'text-neutral-900'}`}>{msg.messageText}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Input Bar */}
            {pendingAttachment && (
              <View className="px-4 py-2 bg-neutral-50 flex-row items-center justify-between border-t border-neutral-100">
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <Image source={{ uri: pendingAttachment.uri }} className="w-10 h-10 rounded-lg" />
                  <Text className="text-xs font-bold">Attachment Ready</Text>
                </View>
                <Pressable onPress={() => setPendingAttachment(null)}><FontAwesome5 name="times" size={14} color="#737373" /></Pressable>
              </View>
            )}
            <View className="px-3 py-2 border-t border-neutral-200 flex-row items-center" style={{ gap: 8 }}>
              <Pressable onPress={() => Alert.alert("Coming Soon", "File attachments (PDF/DOC) are coming to mobile soon.")} className="w-8 h-8 items-center justify-center rounded-full hover:bg-neutral-100"><FontAwesome5 name="paperclip" size={16} color="#737373" /></Pressable>
              <Pressable onPress={pickImage} className="w-8 h-8 items-center justify-center rounded-full hover:bg-neutral-100"><FontAwesome5 name="camera" size={16} color="#737373" /></Pressable>
              <TextInput className="flex-1 bg-neutral-100 rounded-full px-4 py-2 text-sm" placeholder="Type a message..." value={newMessage} onChangeText={setNewMessage} />
              {(role?.toLowerCase() === 'contractor') && (
                <Pressable onPress={() => { Alert.alert('Coming Soon', 'Mobile quote creation is being synced.'); }}><FontAwesome5 name="file-invoice-dollar" size={18} color="#737373" /></Pressable>
              )}
              <Pressable onPress={handleSendMessage} disabled={!newMessage.trim() && !pendingAttachment} className={`w-10 h-10 rounded-full items-center justify-center ${(newMessage.trim() || pendingAttachment) ? 'bg-indigo-600' : 'bg-neutral-200'}`}>
                <FontAwesome5 name="paper-plane" size={14} color="white" />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Lightbox */}
      <ImageLightbox images={activeImage ? [activeImage] : []} visible={lightboxVisible} onClose={() => setLightboxVisible(false)} />
    </KeyboardAvoidingView>
  );
};

export default MessagesScreen;
