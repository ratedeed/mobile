import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  Image,
  TextInput,
  Animated,
  RefreshControl,
  Modal,
  Linking,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import ImageLightbox from "../components/ImageLightbox";
import * as ImagePicker from "expo-image-picker";
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  createConversation,
  extractId,
  registerSocket,
  joinConversationSocket,
  leaveConversationSocket,
  onNewMessage,
  offNewMessage,
  onMessageRead,
  offMessageRead,
  onTyping,
  offTyping,
  onUserOnlineStatus,
  offUserOnlineStatus,
  emitTyping,
  emitMessageRead,
  blockUser,
} from "../api";
import { useAuth } from "../context/AuthContext";
import { useContractor } from "../context/ContractorContext";
import { useNotifications } from "../context/NotificationsContext";
import { SvgImage } from "../components/common/SvgImage";
import { getProfileImageUrl, isSvgUrl } from "../utils/avatarUtils";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../utils/cloudinary";
import ActionSheet from "../components/common/ActionSheet";
import QuoteCreationSheet from "../components/contractor/QuoteCreationSheet";
import HapticFeedback from "../utils/haptics";
import { VerifiedBadge } from "../components/common/VerifiedBadge";

// ─── Constants ────────────────────────────────────────────────────────────────
const REPORT_CATEGORIES = [
  "Harassment or bullying",
  "Hate speech",
  "Scam or fraud attempt",
  "Inappropriate content",
  "Spam or solicitation",
  "Threats of violence",
  "Other",
];

const TYPING_TIMEOUT = 3000;

// ─── Bulletproof ID Helpers ───────────────────────────────────────────────────
const resolveId = (obj) => {
  if (!obj) return "";
  if (typeof obj === "string") return obj.toLowerCase().trim();
  if (typeof obj === "number") return String(obj).toLowerCase().trim();
  if (typeof obj === "object") {
    const raw = obj._id || obj.id || obj.userId;
    if (raw) return String(raw).toLowerCase().trim();
    if (typeof obj.toString === "function") {
      const str = obj.toString();
      if (str && str !== "[object Object]") return str.toLowerCase().trim();
    }
  }
  return "";
};

/** Extracts ALL possible IDs from a user/participant object */
const collectAllIds = (obj) => {
  const ids = [];
  const add = (v) => {
    const r = resolveId(v);
    if (r && r !== "system" && !ids.includes(r)) ids.push(r);
  };
  add(obj);
  if (typeof obj === "object" && obj !== null) {
    add(obj._id);
    add(obj.id);
    add(obj.userId);
    if (obj.user) {
      add(obj.user);
      if (typeof obj.user === "object" && obj.user !== null) {
        add(obj.user._id);
        add(obj.user.id);
        add(obj.user.userId);
      }
    }
  }
  return ids;
};

const getParticipantDisplayName = (entity) => {
  if (!entity) return "Unknown";
  const firstLast = `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
  return (
    firstLast ||
    entity.contactPerson ||
    (entity.name && entity.name !== "Unknown" ? entity.name : "") ||
    entity.businessName ||
    entity.companyName ||
    "Unknown"
  );
};

function formatRelativeTime(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function formatChatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === new Date(now - 86400000).toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return ""; }
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
const TypingIndicator = ({ name }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 180, useNativeDriver: true }),
        ])
      );
    const combo = Animated.parallel([anim(dot1, 0), anim(dot2, 120), anim(dot3, 240)]);
    combo.start();
    return () => combo.stop();
  }, []);

  const interp = (dot) => dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  return (
    <View className="flex-row items-end px-4 mb-3">
      <View className="bg-white dark:bg-neutral-800 px-4 py-3 rounded-2xl rounded-bl-sm flex-row items-center" style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 2 }}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} className="w-[7px] h-[7px] bg-neutral-400 rounded-full mx-[2px]" style={{ transform: [{ translateY: interp(d) }] }} />
        ))}
        <Text className="text-[11px] text-neutral-400 ml-2 font-medium">{name ? `${name} is typing` : "typing"}</Text>
      </View>
    </View>
  );
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
const SkeletonRow = () => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, []);

  return (
    <View className="flex-row items-center px-5 py-3" style={{ gap: 14 }}>
      <Animated.View className="w-[52px] h-[52px] rounded-full bg-neutral-200" style={{ opacity: pulse }} />
      <View className="flex-1" style={{ gap: 8 }}>
        <Animated.View className="h-3.5 bg-neutral-200 rounded-full" style={{ opacity: pulse, width: "40%" }} />
        <Animated.View className="h-3 bg-neutral-100 rounded-full" style={{ opacity: pulse, width: "70%" }} />
      </View>
    </View>
  );
};

// ─── Empty Inbox ──────────────────────────────────────────────────────────────
const EmptyInbox = () => (
  <View className="flex-1 items-center justify-center px-10 pt-20">
    <View className="w-20 h-20 rounded-full bg-indigo-50 items-center justify-center mb-5">
      <FontAwesome5 name="comments" size={32} color="#818CF8" />
    </View>
    <Text className="text-xl font-bold text-neutral-800 dark:text-white text-center mb-2">No messages yet</Text>
    <Text className="text-sm text-neutral-400 dark:text-neutral-500 text-center leading-5">When you connect with contractors, your conversations will appear here.</Text>
  </View>
);

// ─── Report Modal ─────────────────────────────────────────────────────────────
const ReportModal = ({ visible, onClose, userName, onReport }) => {
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try { await onReport(selected, details); setSelected(null); setDetails(""); onClose(); } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white dark:bg-neutral-950">
        <View className="px-5 pt-14 pb-4 border-b border-neutral-100 dark:border-neutral-800 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-neutral-900 dark:text-white">Report</Text>
          <Pressable onPress={onClose} className="p-1"><FontAwesome5 name="times" size={18} color={isDark ? "#a3a3a3" : "#737373"} /></Pressable>
        </View>
        <Text className="px-5 pt-5 pb-2 text-sm text-neutral-500 dark:text-neutral-400">Why are you reporting {userName}?</Text>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          {REPORT_CATEGORIES.map((cat) => (
            <Pressable key={cat} onPress={() => setSelected(cat)} className="flex-row items-center px-5 py-4 border-b border-neutral-100 dark:border-neutral-800" style={{ gap: 12 }}>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${selected === cat ? "border-red-500 bg-red-500" : "border-neutral-300 dark:border-neutral-600"}`}>
                {selected === cat && <FontAwesome5 name="check" size={9} color="white" />}
              </View>
              <Text className={`text-[15px] ${selected === cat ? "text-neutral-900 dark:text-white font-semibold" : "text-neutral-700 dark:text-neutral-300"}`}>{cat}</Text>
            </Pressable>
          ))}
          {selected && (
            <View className="px-5 pt-5">
              <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Additional details (optional)</Text>
              <TextInput className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3 text-sm min-h-[80px] text-neutral-900 dark:text-white" placeholder="Tell us more..." placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"} value={details} onChangeText={setDetails} multiline textAlignVertical="top" />
            </View>
          )}
        </ScrollView>
        {selected && (
          <View className="px-5 pb-10 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Pressable onPress={handleSubmit} disabled={submitting} className={`py-4 rounded-xl items-center ${submitting ? "bg-red-300 dark:bg-red-900/40" : "bg-red-500"}`}>
              {submitting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold text-[15px]">Submit Report</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── Conversation Item ────────────────────────────────────────────────────────
const ConversationItem = React.memo(function ConversationItem({ conv, currentUserId, onlineUsers, onPress }) {
  const other = conv.otherParticipant;
  const displayName = getParticipantDisplayName(other);
  const avatarUrl = getProfileImageUrl(displayName, other?.profilePicture || "", other?.category);
  const isOnline = onlineUsers[other?._id] || false;
  const hasAttachment = conv.lastMessage?.attachmentUrl;
  const isImage = hasAttachment && /\.(jpg|jpeg|png|gif|webp)$/i.test(conv.lastMessage.attachmentUrl);
  const lastMsgText = conv.lastMessage?.messageText || (hasAttachment ? (isImage ? "📷 Photo" : "📎 Attachment") : "No messages yet");
  const lastMsgTime = conv.lastMessage?.createdAt || "";

  return (
    <Pressable onPress={onPress} className="flex-row items-center px-5 py-3.5 active:bg-neutral-50 dark:active:bg-neutral-800" style={{ gap: 14 }}>
      <View className="relative shrink-0">
        {isSvgUrl(avatarUrl) ? (
          <View className="w-[54px] h-[54px] rounded-full overflow-hidden"><SvgImage uri={avatarUrl} width="100%" height="100%" /></View>
        ) : (
          <Image source={{ uri: avatarUrl }} className="w-[54px] h-[54px] rounded-full bg-neutral-100 dark:bg-neutral-700" />
        )}
        {isOnline && <View className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-[2.5px] border-white dark:border-neutral-900" />}
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1" style={{ gap: 5 }}>
            <Text className={`text-[15px] truncate ${conv.unreadCount > 0 ? "font-bold text-neutral-900 dark:text-white" : "font-semibold text-neutral-800 dark:text-neutral-300"}`} numberOfLines={1}>{displayName}</Text>
            {other?.role === "contractor" && (other?.isVerified || other?.isTopRated) && <VerifiedBadge size={13} animate={false} />}
          </View>
          <Text className={`text-[11px] shrink-0 ml-3 ${conv.unreadCount > 0 ? "text-indigo-600 font-semibold" : "text-neutral-400 dark:text-neutral-500"}`}>{lastMsgTime ? formatRelativeTime(lastMsgTime) : ""}</Text>
        </View>
        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
          <Text className={`text-[13px] flex-1 truncate ${conv.unreadCount > 0 ? "text-neutral-700 dark:text-neutral-300 font-medium" : "text-neutral-400 dark:text-neutral-500"}`} numberOfLines={1}>{lastMsgText}</Text>
          {conv.unreadCount > 0 && (
            <View className="bg-indigo-600 min-w-[20px] h-[20px] rounded-full items-center justify-center px-1.5">
              <Text className="text-white text-[10px] font-bold">{conv.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const MessagesScreen = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId: currentUserId, userRole, isAuthenticated } = useAuth();
  const { contractorProfile } = useContractor();
  const { refreshUnreadMessagesCount } = useNotifications();
  const myContractorId = contractorProfile?._id || contractorProfile?.id;

  const recipientId = route.params?.recipientId;
  const recipientName = route.params?.recipientName;
  const conversationId = route.params?.conversationId;

  const [conversations, setConversations] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [activeImage, setActiveImage] = useState(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showQuoteSheet, setShowQuoteSheet] = useState(false);
  
  const messagesRef = useRef();
  const selectedConvRef = useRef();
  selectedConvRef.current = selectedConversation;
  const typingTimeoutRef = useRef(null);
  const lastTypingEmit = useRef(0);

  // ─── isMe detection (unified User identity) ──────────────────────────────────
  const myIds = useMemo(() => {
    const ids = new Set();
    const id = resolveId(currentUserId);
    if (id) ids.add(id);
    return ids;
  }, [currentUserId]);

  const isMessageFromMe = useCallback(
    (msg) => {
      if (msg.__isLocalSent) return true;
      if (msg.type === "system") return false;
      const senderId = resolveId(msg.senderId);
      return senderId === resolveId(currentUserId);
    },
    [currentUserId]
  );

  // ─── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    registerSocket(currentUserId);

    const handleNewMessage = (msg) => {
      const convoId = msg.conversationId || msg.conversation;
      setConversations((prev) => {
        const convo = prev[convoId] || { conversationId: convoId, _id: convoId, participants: [], messages: [], lastMessage: null, unreadCount: 0 };
        const isFromMe = isMessageFromMe(msg);
        const inc = !isFromMe && selectedConvRef.current?.conversationId !== convoId;
        return { ...prev, [convoId]: { ...convo, lastMessage: msg, unreadCount: inc ? (convo.unreadCount || 0) + 1 : convo.unreadCount } };
      });

      if (selectedConvRef.current && (msg.conversationId === selectedConvRef.current.conversationId || msg.conversation === selectedConvRef.current.conversationId)) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        if (!isMessageFromMe(msg)) {
          emitMessageRead(msg._id, currentUserId, selectedConvRef.current?.conversationId);
          refreshUnreadMessagesCount();
        }
      }
    };

    const handleRead = ({ messageId }) => setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, read: true } : m)));

    const handleTyping = ({ conversationId, userId: typerId }) => {
      if (selectedConvRef.current?.conversationId === conversationId && !myIds.has(resolveId(typerId))) {
        setIsOtherTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), TYPING_TIMEOUT);
      }
    };

    const handleStatus = ({ userId: uid, isOnline }) => setOnlineUsers((prev) => ({ ...prev, [uid]: isOnline }));

    onNewMessage(handleNewMessage);
    onMessageRead(handleRead);
    onTyping(handleTyping);
    onUserOnlineStatus(handleStatus);

    return () => {
      offNewMessage(handleNewMessage);
      offMessageRead(handleRead);
      offTyping(handleTyping);
      offUserOnlineStatus(handleStatus);
      leaveConversationSocket(selectedConvRef.current?._id);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [currentUserId, myIds, isMessageFromMe]);

  // ─── Join / leave conversation room ────────────────────────────────────────
  useEffect(() => {
    const cId = selectedConversation?.conversationId;
    if (cId && !cId.startsWith("temp-")) {
      joinConversationSocket(cId);
      return () => leaveConversationSocket(cId);
    }
  }, [selectedConversation?.conversationId]);

  // ─── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async (pullRefresh = false) => {
    if (!currentUserId) return;
    if (!pullRefresh && Object.keys(conversations).length === 0) setLoading(true);
    if (pullRefresh) setRefreshing(true);
    try {
      const data = await fetchConversations();
      if (Array.isArray(data)) {
        const myAuthIdStr = resolveId(currentUserId);
        const contractorIdStr = resolveId(myContractorId);

        const map = data.reduce((acc, conv) => {
          acc[conv.conversationId] = { ...conv, _id: conv.conversationId };

          let me = null;
          let other = null;

          if (conv.participants) {
            for (const p of conv.participants) {
              const pIds = collectAllIds(p);
              if (pIds.includes(myAuthIdStr) || pIds.includes(contractorIdStr)) {
                me = p;
              } else {
                other = p;
              }
            }

            if (!me && conv.participants.length > 1) {
              if (other) me = conv.participants.find(p => p !== other);
              else {
                other = conv.participants.find(p => collectAllIds(p).includes(resolveId(recipientId)));
                if (other) me = conv.participants.find(p => p !== other);
                else {
                  // Last resort: compare with otherParticipant from API if available
                  const convOther = conv.otherParticipant || conv.participant2User;
                  if (convOther) {
                    other = convOther;
                    me = conv.participants.find(p => p !== other) || conv.participants[0];
                  } else {
                    me = conv.participants[0];
                    other = conv.participants[1];
                  }
                }
              }
            }
          }

          // NEVER let otherParticipant be me - use recipient as fallback
          if (other && me && collectAllIds(other).some(id => id === myAuthIdStr || id === contractorIdStr)) {
            [me, other] = [other, me]; // Swap if we got them backwards
          }

          acc[conv.conversationId].otherParticipant = other || conv.otherParticipant || conv.participant2User || conv.participants?.find(p => p !== me) || conv.participants?.[0];

          return acc;
        }, {});
        
        setConversations(map);
        if (recipientId && !selectedConversation) {
          const existing = Object.values(map).find((c) => collectAllIds(c.otherParticipant).includes(resolveId(recipientId)));
          if (existing) setSelectedConversation(existing);
          else setSelectedConversation({ conversationId: `temp-${Date.now()}`, otherParticipant: { _id: recipientId, firstName: recipientName || "User", role: route.params?.recipientRole || "User", profilePicture: route.params?.recipientImage || "" }, messages: [], lastMessage: null });
        }
        if (conversationId && !selectedConversation) {
          const existing = Object.values(map).find((c) => c.conversationId === conversationId || c._id === conversationId);
          if (existing) setSelectedConversation(existing);
        }
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [currentUserId, recipientId, recipientName, myContractorId, conversationId]);

  useEffect(() => { if (currentUserId) loadConversations(); }, [currentUserId]);

  // Auto-select conversation when conversationId is provided (e.g. from notification tap)
  useEffect(() => {
    if (!conversationId || selectedConversation) return;
    const existing = Object.values(conversations).find(
      (c) => c.conversationId === conversationId || c._id === conversationId
    );
    if (existing) {
      setSelectedConversation(existing);
    }
  }, [conversationId, conversations, selectedConversation]);

  // ─── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (conversationId) => {
    setLoading(true);
    try {
      const data = await fetchMessages(conversationId);
      const msgs = Array.isArray(data) ? data : data?.messages || [];
      setMessages([...msgs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      
      // Immediately clear the unread dot locally to avoid UI lag
      setConversations(prev => ({
        ...prev,
        [conversationId]: {
          ...prev[conversationId],
          unreadCount: 0
        }
      }));
      
      refreshUnreadMessagesCount(); // Update global badge when chat is opened
    } catch {} finally { setLoading(false); }
  }, [currentUserId, refreshUnreadMessagesCount]);

  useEffect(() => {
    const cId = selectedConversation?.conversationId;
    if (!cId) return;
    if (cId.startsWith("temp-")) setMessages([]);
    else loadMessages(cId);
  }, [selectedConversation?.conversationId]);

  // ─── Process messages for grouping ─────────────────────────────────────────
  const processedMessages = useMemo(() => {
    return messages.map((msg, idx) => {
      const isMe = isMessageFromMe(msg);
      const prevMsg = idx > 0 ? messages[idx - 1] : null;
      const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
      const prevIsMe = prevMsg ? isMessageFromMe(prevMsg) : null;
      const nextIsMe = nextMsg ? isMessageFromMe(nextMsg) : null;

      const sameSenderAsPrev = prevMsg && isMe === prevIsMe;
      const sameSenderAsNext = nextMsg && isMe === nextIsMe;

      const msgDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : "";
      const prevDate = prevMsg?.createdAt ? new Date(prevMsg.createdAt).toDateString() : "";
      const showDate = msgDate && msgDate !== prevDate;

      const timeGap = prevMsg && msg.createdAt && prevMsg.createdAt ? new Date(msg.createdAt) - new Date(prevMsg.createdAt) : 0;
      const newGroup = !sameSenderAsPrev || timeGap > 300000;
      const nextTimeGap = nextMsg && msg.createdAt && nextMsg.createdAt ? new Date(nextMsg.createdAt) - new Date(msg.createdAt) : 0;
      const isLast = !sameSenderAsNext || nextTimeGap > 300000;

      return {
        ...msg,
        isMe,
        isFirstInGroup: newGroup,
        isLastInGroup: isLast,
        showDate,
        timeStr: msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      };
    });
  }, [messages, isMessageFromMe]);

  // ─── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !pendingAttachment) || !selectedConversation || !currentUserId) return;
    HapticFeedback.medium();
    try {
      let cId = selectedConversation.conversationId || selectedConversation._id;
      let targetId = resolveId(selectedConversation.otherParticipant);

      if (cId?.startsWith("temp-")) {
        const resp = await createConversation([currentUserId, targetId]);
        cId = resp.conversationId;
        if (resp.participants) {
          setSelectedConversation(prev => ({ ...prev, conversationId: cId, _id: cId, participants: resp.participants }));
        } else {
          setSelectedConversation(prev => ({ ...prev, conversationId: cId, _id: cId }));
        }
      }

      let attachmentUrl;
      if (pendingAttachment) {
        setIsUploading(true);
        try {
          let uploadUri = pendingAttachment.uri;
          if (pendingAttachment.base64) {
            const mime = pendingAttachment.mimeType || 'image/jpeg';
            uploadUri = `data:${mime};base64,${pendingAttachment.base64}`;
          }
          attachmentUrl = await uploadToCloudinary(uploadUri, CLOUDINARY_FOLDERS.CHAT);
        } catch (e) { Alert.alert("Upload Error", "Failed to upload attachment"); setIsUploading(false); return; }
        setIsUploading(false);
      }

      const sent = await sendMessage(cId, targetId, newMessage, attachmentUrl);
      sent.__isLocalSent = true;

      setNewMessage("");
      setPendingAttachment(null);

      setConversations((prev) => {
        const convo = prev[sent.conversationId] || { conversationId: sent.conversationId, _id: sent.conversationId, participants: [], messages: [], lastMessage: null, unreadCount: 0, otherParticipant: selectedConversation.otherParticipant };
        return { ...prev, [sent.conversationId]: { ...convo, lastMessage: sent } };
      });

      setMessages((prev) => {
        if (prev.some((m) => m._id === sent._id)) return prev;
        return [...prev, sent].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    } catch (e) { Alert.alert("Error", e?.message || 'Failed to send message.'); }
  };

  const handleTextChange = useCallback((text) => {
    setNewMessage(text);
    const cId = selectedConversation?.conversationId;
    if (cId && !cId.startsWith("temp-")) {
      const now = Date.now();
      if (now - lastTypingEmit.current > 2000) { emitTyping(cId, currentUserId, true); lastTypingEmit.current = now; }
    }
  }, [selectedConversation, currentUserId]);

  const pickImage = async () => {
    HapticFeedback.selection();
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert("File too large", "Please choose an image under 5MB.");
      return;
    }
    setPendingAttachment(asset);
  };

  const handleReport = async (category, details) => {
    const targetId = resolveId(selectedConversation?.otherParticipant);
    const convId = selectedConversation?.conversationId;
    if (!targetId || !convId) {
      Alert.alert("Error", "Unable to submit report. Please try again.");
      return;
    }
    try {
      const { reportConversation } = await import("../api");
      await reportConversation(targetId, convId, category, details || "");
      Alert.alert("Report Submitted", "Thank you. We'll review your report and take appropriate action.");
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to submit report. Please try again.");
    }
  };

  const handleBlockUser = async () => {
    const targetId = resolveId(selectedConversation?.otherParticipant);
    if (!targetId) {
      Alert.alert("Error", "Unable to block user. Please try again.");
      return;
    }
    try {
      await blockUser(targetId);
      Alert.alert("Blocked", `${chatName} has been blocked. You will no longer receive messages from them.`);
      setSelectedConversation(null);
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to block user. Please try again.");
    }
  };

  const filteredConversations = useMemo(() => {
    return Object.values(conversations)
      .filter((c) => c.lastMessage)
      .filter((c) => !searchQuery || getParticipantDisplayName(c.otherParticipant).toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  }, [conversations, searchQuery]);

  const chatOther = selectedConversation?.otherParticipant;
  const chatName = getParticipantDisplayName(chatOther) || recipientName || "Chat";
  const chatAvatar = getProfileImageUrl(chatName, chatOther?.profilePicture || route.params?.recipientImage || "");
  const chatOnline = onlineUsers[resolveId(chatOther)] || false;
  const showChat = selectedConversation || route.name === "ChatScreen";

  // If deep-linked to ChatScreen but no conversation loaded yet, redirect back
  useEffect(() => {
    if (route.name === "ChatScreen" && !selectedConversation && !loading && Object.values(conversations).length > 0) {
      const target = conversations[Object.keys(conversations)[0]];
      if (target) setSelectedConversation(target);
    }
  }, [route.name, selectedConversation, loading, conversations]);

  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center px-8" style={{ paddingTop: insets.top }}>
        <View className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full items-center justify-center mb-6">
          <FontAwesome5 name="comments" size={32} color="#4F46E5" />
        </View>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 text-center">Messages</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-8 leading-5">
          Sign in to chat with contractors, discuss projects, and get quotes.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Login')}
          className="w-full py-4 bg-indigo-600 rounded-2xl items-center mb-3"
        >
          <Text className="text-white font-bold text-[15px]">Sign In or Create Account</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Explore')}
          className="w-full py-4 rounded-2xl items-center"
        >
          <Text className="text-neutral-500 dark:text-neutral-400 font-semibold text-[15px]">Continue Browsing</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white dark:bg-neutral-950" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
      <View className="flex-1" style={{ paddingTop: insets.top }}>

        {!showChat ? (
          <View className="flex-1">
            <View className="px-5 pt-3 pb-1"><Text className="text-[28px] font-bold text-neutral-900 dark:text-white tracking-tight">Messages</Text></View>
            <View className="px-5 pb-2 pt-1">
              <View className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-3 flex-row items-center">
                <FontAwesome5 name="search" size={13} color="#a3a3a3" />
                <TextInput className="flex-1 ml-3 text-[14px] text-neutral-800" placeholder="Search conversations..." placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"} value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery ? <Pressable onPress={() => setSearchQuery("")}><FontAwesome5 name="times-circle" size={14} color="#a3a3a3" /></Pressable> : null}
              </View>
            </View>
            {loading && filteredConversations.length === 0 ? (
              <View className="pt-4">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</View>
            ) : filteredConversations.length === 0 ? (
              <EmptyInbox />
            ) : (
              <FlatList data={filteredConversations} keyExtractor={(c) => c.conversationId || c._id} renderItem={({ item }) => <ConversationItem conv={item} currentUserId={currentUserId} onlineUsers={onlineUsers} onPress={() => { HapticFeedback.selection(); setSelectedConversation(item); }} />} ItemSeparatorComponent={() => <View className="ml-[82px] border-b border-neutral-100 dark:border-neutral-800" />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadConversations(true)} tintColor="#818CF8" />} contentContainerStyle={{ paddingBottom: 20 }} />
            )}
          </View>
        ) : (
          <View className="flex-1">
            <View className="px-4 py-3 flex-row items-center bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800/80" style={{ gap: 12 }}>
              <Pressable onPress={() => { if (route.name === "ChatScreen") navigation.goBack(); else setSelectedConversation(null); }} className="w-11 h-11 items-center justify-center rounded-full -ml-1" accessibilityLabel="Go back" accessibilityRole="button">
                <FontAwesome5 name="chevron-left" size={16} color={isDark ? "#e5e5e5" : "#171717"} />
              </Pressable>
              <View className="relative">
                {isSvgUrl(chatAvatar) ? <View className="w-10 h-10 rounded-full overflow-hidden"><SvgImage uri={chatAvatar} width="100%" height="100%" /></View> : <Image source={{ uri: chatAvatar }} className="w-10 h-10 rounded-full bg-neutral-100" />}
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Text className="text-[15px] font-bold text-neutral-900 dark:text-white truncate" numberOfLines={1}>{chatName}</Text>
                  {chatOther?.role === "contractor" && (chatOther?.isVerified || chatOther?.isTopRated) && <VerifiedBadge size={14} animate={false} />}
                </View>
              </View>
              <Pressable onPress={() => setActionSheetVisible(true)} className="w-11 h-11 items-center justify-center rounded-full" accessibilityLabel="Chat options" accessibilityRole="button"><FontAwesome5 name="ellipsis-h" size={16} color={isDark ? "#a3a3a3" : "#525252"} /></Pressable>
            </View>

            <ScrollView ref={messagesRef} className="flex-1 bg-neutral-50/60 dark:bg-neutral-950/60" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }} onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: false })} onScroll={(e) => { const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent; setShowScrollBtn(contentSize.height - layoutMeasurement.height - contentOffset.y > 300); }} scrollEventThrottle={64}>
              {loading ? (
                <View className="items-center py-10"><ActivityIndicator size="small" color="#818CF8" /></View>
              ) : (
                processedMessages.map((msg, idx) => {
                  if (msg.type === "system" || resolveId(msg.senderId || msg.sender) === "system") return <View key={msg._id || `s-${idx}`} className="items-center my-4"><View className="bg-neutral-200/60 dark:bg-neutral-700/60 px-4 py-1.5 rounded-full"><Text className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">{msg.messageText}</Text></View></View>;
                  const isMe = msg.isMe;
                  return (
                    <View key={msg._id || `m-${idx}`}>
                      {msg.showDate && <View className="items-center my-5"><View className="bg-white/80 dark:bg-neutral-800/80 px-4 py-1.5 rounded-full shadow-sm border border-neutral-100/50 dark:border-neutral-700/50"><Text className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{formatChatDate(msg.createdAt)}</Text></View></View>}
                      <View className={`flex-row ${isMe ? "justify-end" : "justify-start"} ${msg.isFirstInGroup ? "mt-4" : "mt-1"}`}>
                        {!isMe && msg.isFirstInGroup ? <View className="w-8 mr-2 mt-1 items-center">{isSvgUrl(chatAvatar) ? <View className="w-7 h-7 rounded-full overflow-hidden"><SvgImage uri={chatAvatar} width="100%" height="100%" /></View> : <Image source={{ uri: chatAvatar }} className="w-7 h-7 rounded-full bg-neutral-100" />}</View> : !isMe ? <View className="w-8 mr-2" /> : null}
                        <View className={`${(msg.type === "quote" || msg.quoteId) && msg.quote ? "w-[92%]" : "max-w-[78%]"} ${isMe ? "items-end" : "items-start"}`}>
                          {(msg.type === "quote" || msg.quoteId) && msg.quote ? (
                            <>
                              <View className="w-full bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden" style={{ shadowColor: "#000", shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: isDark ? 0 : 2 }}>
                                {/* Status banner */}
                                {msg.quote.status && msg.quote.status !== 'pending' && msg.quote.status !== 'pending_user_approval' && (
                                  <View className={`px-4 py-2 flex-row items-center border-b ${msg.quote.status === 'accepted' || msg.quote.status === 'funded_in_progress' ? (isDark ? 'bg-emerald-900/40 border-emerald-800' : 'bg-emerald-50 border-emerald-100') : msg.quote.status === 'rejected' || msg.quote.status === 'declined' ? (isDark ? 'bg-red-900/40 border-red-800' : 'bg-red-50 border-red-100') : (isDark ? 'bg-amber-900/40 border-amber-800' : 'bg-amber-50 border-amber-100')}`}>
                                    <FontAwesome5 name={msg.quote.status === 'accepted' || msg.quote.status === 'funded_in_progress' ? 'check-circle' : msg.quote.status === 'rejected' || msg.quote.status === 'declined' ? 'times-circle' : 'clock'} size={12} color={msg.quote.status === 'accepted' || msg.quote.status === 'funded_in_progress' ? (isDark ? '#6ee7b7' : '#059669') : msg.quote.status === 'rejected' || msg.quote.status === 'declined' ? (isDark ? '#fca5a5' : '#dc2626') : (isDark ? '#fcd34d' : '#d97706')} />
                                    <Text className={`text-[12px] font-semibold ml-2 ${msg.quote.status === 'accepted' || msg.quote.status === 'funded_in_progress' ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : msg.quote.status === 'rejected' || msg.quote.status === 'declined' ? (isDark ? 'text-red-300' : 'text-red-700') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}>
                                      {msg.quote.status === 'accepted' || msg.quote.status === 'funded_in_progress' ? 'Quote Accepted' : msg.quote.status === 'rejected' || msg.quote.status === 'declined' ? 'Quote Declined' : 'Pending Review'}
                                    </Text>
                                  </View>
                                )}
                                
                                {/* Contractor row */}
                                <View className="flex-row p-4 pb-3" style={{ gap: 12 }}>
                                  {isSvgUrl(chatAvatar) ? (
                                    <View className="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-700"><SvgImage uri={chatAvatar} width="100%" height="100%" /></View>
                                  ) : (
<Image source={{ uri: chatAvatar }} className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700" />
                                  )}
                                  <View className="flex-1 min-w-0">
                                    <Text className="text-[14px] font-semibold text-neutral-900 dark:text-white" numberOfLines={1}>{chatName}</Text>
                                    <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                                      <FontAwesome5 name="star" size={10} color="#eab308" solid />
                                      <Text className="text-[12px]" style={{ color: isDark ? '#d4d4d4' : '#737373' }}>{msg.quote.contractor?.averageRating || '5.0'}</Text>
                                    </View>
                                  </View>
                                </View>
                                
                                {/* Category + Description */}
                                <View className="px-4 pb-3">
                                  <View className="flex-row mb-1.5" style={{ gap: 6 }}>
                                    <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: isDark ? '#1e3a8a' : '#eff6ff' }}><Text className="text-[11px] font-semibold" style={{ color: isDark ? '#93c5fd' : '#1d4ed8' }}>{msg.quote.serviceType || msg.quote.category || 'Service'}</Text></View>
                                    {msg.quote.revisions > 0 && <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: isDark ? '#581c87' : '#faf5ff' }}><Text className="text-[11px] font-medium" style={{ color: isDark ? '#d8b4fe' : '#7e22ce' }}>Revision #{msg.quote.revisions}</Text></View>}
                                  </View>
                                  <Text className="text-[15px] font-semibold" style={{ color: isDark ? '#ffffff' : '#171717' }}>{msg.quote.description || msg.quote.projectName || 'Project Quote'}</Text>
                                  {msg.quote.description && msg.quote.projectName && msg.quote.description !== msg.quote.projectName && (
                                    <Text className="text-[13px] mt-1 leading-[18px]" style={{ color: isDark ? '#d4d4d4' : '#525252' }}>{msg.quote.description}</Text>
                                  )}
                                </View>
                                
                                {/* Dates */}
                                {(msg.quote.estimatedStartDate || msg.quote.estimatedCompletionDate) && (
                                  <View className="px-4 pb-3 flex-row" style={{ gap: 16 }}>
                                    {msg.quote.estimatedStartDate && (
                                      <View className="flex-row items-center" style={{ gap: 6 }}>
                                        <FontAwesome5 name="calendar" size={12} color={isDark ? "#a3a3a3" : "#737373"} />
                                        <Text className="text-[12px] font-medium" style={{ color: isDark ? '#d4d4d4' : '#404040' }}>
                                          {(() => { try { return new Date(msg.quote.estimatedStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return 'TBD'; } })()}
                                        </Text>
                                      </View>
                                    )}
                                    {msg.quote.estimatedCompletionDate && (
                                      <View className="flex-row items-center" style={{ gap: 6 }}>
                                        <FontAwesome5 name="clock" size={12} color={isDark ? "#a3a3a3" : "#737373"} />
                                        <Text className="text-[12px]" style={{ color: isDark ? '#d4d4d4' : '#737373' }}>
                                          {(() => { try { return new Date(msg.quote.estimatedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return 'TBD'; } })()}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                )}
                                
                                {/* Divider */}
                                <View className="mx-4 h-px bg-neutral-100 dark:bg-neutral-700" />
                                
                                {/* Line items */}
                                <View className="p-4 py-3" style={{ gap: 10 }}>
                                  {(msg.quote.lineItems || []).length > 0 ? (
                                    msg.quote.lineItems.map((item, idx) => (
                                      <View key={idx} className="flex-row justify-between">
                                        <Text className="text-[13px] flex-1 mr-3" numberOfLines={1} style={{ color: isDark ? '#d4d4d4' : '#525252' }}>{item.description || item.label || `Item ${idx + 1}`}</Text>
                                        <Text className="text-[13px] font-medium" style={{ color: isDark ? '#ffffff' : '#171717' }}>${((item.amount || 0) / 100).toLocaleString()}</Text>
                                      </View>
                                    ))
                                  ) : (
                                    <View className="flex-row justify-between">
                                      <Text className="text-[13px]" style={{ color: isDark ? '#d4d4d4' : '#525252' }}>Project Cost</Text>
                                      <Text className="text-[13px] font-medium" style={{ color: isDark ? '#ffffff' : '#171717' }}>${(() => { const a = (msg.quote.subtotal || msg.quote.totalAmount || 0) / 100; return Number.isFinite(a) ? a.toLocaleString() : '0'; })()}</Text>
                                    </View>
                                  )}
                                  
                                  <View className="h-px bg-neutral-100 dark:bg-neutral-700 my-1" />
                                  
                                  <View className="flex-row justify-between items-center">
                                    <Text className="text-[13px] font-semibold" style={{ color: isDark ? '#ffffff' : '#171717' }}>Total</Text>
                                    <Text className="text-[18px] font-bold" style={{ color: isDark ? '#ffffff' : '#171717' }}>${(() => {
                                      const amount = msg.quote.totalAmount != null ? msg.quote.totalAmount / 100 : msg.quote.total != null ? msg.quote.total : 0;
                                      return Number.isFinite(amount) ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
                                    })()}</Text>
                                  </View>
                                </View>
                                
                                {/* Escrow notice */}
                                <View className="mx-4 mb-4 p-3 rounded-xl flex-row items-start" style={{ gap: 8, backgroundColor: isDark ? '#1e3a8a' : '#eff6ff' }}>
                                  <FontAwesome5 name="shield-alt" size={14} color={isDark ? "#60a5fa" : "#2563EB"} style={{ marginTop: 1 }} />
                                  <Text className="text-[11px] flex-1 leading-[16px]" style={{ color: isDark ? '#bfdbfe' : '#1d4ed8' }}>Secure escrow — funds held until you approve the completed work.</Text>
                                </View>
                                
                                {/* Action button */}
                                <View className="px-4 pb-4">
                                  <Pressable onPress={() => navigation.navigate('QuoteReview', { quoteId: msg.quoteId || msg.quote.id || msg.quote._id })} className="py-3 bg-indigo-600 rounded-xl items-center flex-row justify-center" style={{ gap: 6 }} accessibilityLabel="Review quote details" accessibilityRole="button">
                                    <Text className="text-[14px] font-semibold text-white">Review Details</Text>
                                    <FontAwesome5 name="arrow-right" size={12} color="#FFFFFF" />
                                  </Pressable>
                                </View>
                              </View>
                              {msg.isLastInGroup && <View className={`flex-row items-center mt-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`} style={{ gap: 4 }}><Text className="text-[10px] text-neutral-400 font-medium">{msg.timeStr}</Text>{isMe && <FontAwesome5 name={msg.read ? "check-double" : "check"} size={9} color={msg.read ? "#10b981" : "#c4b5fd"} solid={msg.read} />}</View>}
                            </>
                          ) : (
                            <>
                              <View className={`px-[14px] py-[10px] ${isMe ? `bg-indigo-600 ${msg.isFirstInGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl"}` : `bg-white dark:bg-neutral-800 ${msg.isFirstInGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl"}`}`} style={!isMe ? { shadowColor: isDark ? "transparent" : "#000", shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 8, shadowOffset: { height: 1 }, elevation: isDark ? 0 : 1 } : undefined}>
                                {msg.attachmentUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachmentUrl) && <Pressable onPress={() => { setActiveImage(msg.attachmentUrl); setLightboxVisible(true); }} className="mb-1.5 -mx-[2px] -mt-[2px] overflow-hidden" style={{ borderRadius: msg.isFirstInGroup ? 14 : 16 }}><Image source={{ uri: msg.attachmentUrl }} style={{ width: 240, height: 180 }} resizeMode="cover" /></Pressable>}
                                {msg.attachmentUrl && !/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachmentUrl) && <Pressable onPress={() => Linking.openURL(msg.attachmentUrl)} className={`flex-row items-center p-2.5 rounded-xl mb-1.5 border ${isMe ? "bg-white/10 border-white/20" : "bg-neutral-50 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600"}`}><FontAwesome5 name="file-alt" size={14} color={isMe ? "white" : (isDark ? "#a3a3a3" : "#737373")} /><Text className={`text-[12px] ml-2 font-semibold ${isMe ? "text-white" : "text-neutral-600 dark:text-neutral-300"}`}>View Attachment</Text></Pressable>}
                                {msg.messageText ? <Text className={`text-[15px] leading-[22px] ${isMe ? "text-white" : "text-neutral-800 dark:text-neutral-100"}`}>{msg.messageText}</Text> : null}
                              </View>
                              {msg.isLastInGroup && <View className={`flex-row items-center mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`} style={{ gap: 4 }}><Text className="text-[10px] text-neutral-400 font-medium">{msg.timeStr}</Text>{isMe && <FontAwesome5 name={msg.read ? "check-double" : "check"} size={9} color={msg.read ? "#10b981" : "#c4b5fd"} solid={msg.read} />}</View>}
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
              {isOtherTyping && <TypingIndicator name={chatName?.split(" ")[0]} />}
            </ScrollView>

            {showScrollBtn && <Pressable onPress={() => { HapticFeedback.selection(); messagesRef.current?.scrollToEnd({ animated: true }); }} className="absolute bottom-24 right-4 w-11 h-11 bg-white dark:bg-neutral-800 rounded-full items-center justify-center shadow-lg" style={{ shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 5 }} accessibilityLabel="Scroll to bottom" accessibilityRole="button"><FontAwesome5 name="chevron-down" size={12} color={isDark ? "#a3a3a3" : "#525252"} /></Pressable>}

            {pendingAttachment && <View className="px-4 py-2.5 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 flex-row items-center justify-between"><View className="flex-row items-center" style={{ gap: 10 }}><Image source={{ uri: pendingAttachment.uri }} className="w-12 h-12 rounded-xl" /><View><Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">Image ready to send</Text><Text className="text-[10px] text-neutral-400 dark:text-neutral-500">Tap send to share</Text></View></View><Pressable onPress={() => setPendingAttachment(null)} className="w-7 h-7 bg-neutral-100 dark:bg-neutral-700 rounded-full items-center justify-center"><FontAwesome5 name="times" size={10} color={isDark ? "#a3a3a3" : "#525252"} /></Pressable></View>}

            <View className="px-4 py-3 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 flex-row items-end" style={{ gap: 8, paddingBottom: insets.bottom + 12 || 12 }}>
              <Pressable onPress={pickImage} className="w-11 h-11 items-center justify-center rounded-full bg-neutral-50 dark:bg-neutral-800" accessibilityLabel="Attach image" accessibilityRole="button"><FontAwesome5 name="image" size={15} color={isDark ? "#a3a3a3" : "#737373"} /></Pressable>
              {userRole === 'contractor' && selectedConversation?.conversationId && <Pressable onPress={() => setShowQuoteSheet(true)} className="w-11 h-11 items-center justify-center rounded-full bg-indigo-50" accessibilityLabel="Send quote" accessibilityRole="button"><FontAwesome5 name="tag" size={13} color="#4F46E5" /></Pressable>}
              <View className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-2.5 max-h-[120px]"><TextInput className="text-[15px] text-neutral-800 dark:text-neutral-200 leading-5" placeholder="Type a message..." placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"} value={newMessage} onChangeText={handleTextChange} multiline style={{ maxHeight: 100 }} accessibilityLabel="Message input" accessibilityRole="text" /></View>
              <Pressable onPress={handleSendMessage} disabled={(!newMessage.trim() && !pendingAttachment) || isUploading} className={`w-11 h-11 rounded-full items-center justify-center mb-0.5 ${newMessage.trim() || pendingAttachment ? "bg-indigo-600" : "bg-neutral-200 dark:bg-neutral-700"}`} style={newMessage.trim() || pendingAttachment ? { shadowColor: "#4F46E5", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 3 } : undefined} accessibilityLabel="Send message" accessibilityRole="button">
                {isUploading ? <ActivityIndicator size="small" color="white" /> : <FontAwesome5 name="paper-plane" size={14} color={newMessage.trim() || pendingAttachment ? "white" : (isDark ? "#737373" : "#a3a3a3")} />}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <ImageLightbox images={activeImage ? [activeImage] : []} visible={lightboxVisible} onClose={() => setLightboxVisible(false)} />
      
      <ActionSheet visible={actionSheetVisible} onClose={() => setActionSheetVisible(false)} title="Chat Options" options={[
        { id: "report", label: "Report User", icon: "flag", isDestructive: true, onPress: () => { setActionSheetVisible(false); setTimeout(() => setReportModalVisible(true), 300); } },
        { id: "block", label: "Block User", icon: "ban", isDestructive: true, onPress: () => Alert.alert("Block User", `Are you sure you want to block ${chatName}? You will no longer receive messages from them.`, [{ text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: handleBlockUser }]) }
      ]} />
      
      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} userName={chatName} onReport={handleReport} />

      {userRole === 'contractor' && (selectedConversation?.conversationId || selectedConversation?._id) && (
        <QuoteCreationSheet
          visible={showQuoteSheet}
          onClose={() => setShowQuoteSheet(false)}
          conversationId={selectedConversation.conversationId || selectedConversation._id}
          recipientName={selectedConversation.otherParticipant?.firstName || chatName || "Client"}
          recipientPicture={selectedConversation.otherParticipant?.profilePicture}
          services={(contractorProfile?.servicesOffered || []).map((s) => s.name || s).filter(Boolean)}
          onCreated={() => {
            const convId = selectedConversation?.conversationId || selectedConversation?._id;
            if (convId) {
              loadMessages(convId);
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

export default MessagesScreen;