import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  Image,
  TextInput,
  Animated,
  Modal,
  Linking,
  Keyboard,
  AppState,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import ImageLightbox from "../components/ImageLightbox";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { requestPhotoLibraryPermission } from "../utils/permissions";
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  createConversation,
  deleteConversation,
  extractId,
  registerSocket,
  joinConversationSocket,
  leaveConversationSocket,
  checkOnlineStatus,
  onNewMessage,
  offNewMessage,
  onMessageRead,
  offMessageRead,
  onMessagesRead,
  offMessagesRead,
  onMessageUpdated,
  offMessageUpdated,
  onMessageDeleted,
  offMessageDeleted,
  updateMessage,
  deleteMessage,
  onTyping,
  offTyping,
  onUserOnlineStatus,
  offUserOnlineStatus,
  emitTyping,
  emitMessageRead,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getStripeAccountStatus,
  updateQuoteStatus,
} from "../api";
import { useAuth } from "../context/AuthContext";
import { useContractor } from "../context/ContractorContext";
import { useNotifications } from "../context/NotificationsContext";
import { SvgImage } from "../components/common/SvgImage";
import { getProfileImageUrl, isSvgUrl, getCoverImageUrl } from "../utils/avatarUtils";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../utils/cloudinary";
import ActionSheet from "../components/common/ActionSheet";
import QuoteCreationSheet from "../components/contractor/QuoteCreationSheet";
import HapticFeedback from "../utils/haptics";
import { VerifiedBadge } from "../components/common/VerifiedBadge";
import { BouncingDotsLoader, BouncingRefreshFlatList } from "../components/common";
import ReportModal from "../components/chat/ReportModal";
import ConversationItem from "../components/chat/ConversationItem";

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

const isImageAttachment = (url) => {
  if (!url) return false;
  return (
    /\.(jpg|jpeg|png|gif|webp)$/i.test(url) ||
    url.startsWith("file://") ||
    url.startsWith("content://") ||
    url.startsWith("data:image/")
  );
};

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
  if (!entity) return null;
  if (entity.role === 'admin' || entity.isAdmin) return 'RateDeed Support';
  const firstLast = `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
  return (
    firstLast ||
    entity.contactPerson ||
    (entity.name && entity.name !== "Unknown" ? entity.name : "") ||
    entity.businessName ||
    entity.companyName ||
    null
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

function getQuoteExpiryDisplay(expiresAt) {
  if (!expiresAt) return null;
  try {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `Expires in ${days}d ${hours}h`;
    if (hours > 0) return `Expires in ${hours}h ${mins}m`;
    return `Expires in ${mins}m`;
  } catch {
    return null;
  }
}

function normalizeQuote(q) {
  if (!q) return null;
  if (q._normalized) return q;
  // In RateDeed backend, all monetary fields in Quote are stored in CENTS (e.g. $21.00 = 2100 cents, $1.05 fee = 105 cents)
  const rawTotal = q.totalAmount != null ? Number(q.totalAmount) : (q.total != null ? Number(q.total) : 0);
  const rawFee = q.platformFee != null ? Number(q.platformFee) : (q.serviceFee != null ? Number(q.serviceFee) : 0);
  const isCents = q.totalAmount != null || rawTotal > 500 || rawFee > 50;
  const divisor = isCents ? 100 : 1;

  const total = rawTotal / divisor;
  const subtotal = q.subtotal != null ? Number(q.subtotal) / divisor : total;
  const platformFee = rawFee > 0 ? rawFee / divisor : total * 0.05;
  const diagnosticFeeCredit = q.diagnosticFeeCredit != null ? Number(q.diagnosticFeeCredit) / divisor : 0;
  const lineItems = (q.lineItems || []).map((li) => ({
    ...li,
    amount: li.amount != null ? Number(li.amount) / divisor : 0,
  }));

  return {
    ...q,
    subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    platformFee: Number.isFinite(platformFee) ? platformFee : 0,
    total: Number.isFinite(total) ? total : 0,
    totalAmount: Number.isFinite(total) ? total : 0,
    diagnosticFeeCredit: Number.isFinite(diagnosticFeeCredit) ? diagnosticFeeCredit : 0,
    lineItems,
    _normalized: true,
  };
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

// ─── Message Bubble Skeleton ──────────────────────────────────────────────────
const MessageBubbleSkeleton = () => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true })
      ])
    );
    a.start();
    return () => a.stop();
  }, []);

  return (
    <View className="flex-1 px-4 py-6 bg-neutral-50/60 dark:bg-neutral-950/60" style={{ gap: 20 }}>
      {/* Left message skeleton */}
      <View className="flex-row items-start" style={{ width: '100%' }}>
        <Animated.View className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 mr-2" style={{ opacity: pulse }} />
        <View className="bg-white dark:bg-neutral-900 p-3 rounded-2xl rounded-tl-sm border border-neutral-100 dark:border-neutral-800" style={{ width: '60%', gap: 6 }}>
          <Animated.View className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-full" style={{ opacity: pulse, width: '80%' }} />
          <Animated.View className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full" style={{ opacity: pulse, width: '50%' }} />
        </View>
      </View>

      {/* Right message skeleton */}
      <View className="flex-row justify-end" style={{ width: '100%' }}>
        <View className="bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-2xl rounded-tr-sm border border-indigo-100/50 dark:border-indigo-900/30" style={{ width: '65%', gap: 6 }}>
          <Animated.View className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-full" style={{ opacity: pulse, width: '90%' }} />
          <Animated.View className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full" style={{ opacity: pulse, width: '60%' }} />
        </View>
      </View>

      {/* Left message skeleton */}
      <View className="flex-row items-start" style={{ width: '100%' }}>
        <Animated.View className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 mr-2" style={{ opacity: pulse }} />
        <View className="bg-white dark:bg-neutral-900 p-3 rounded-2xl rounded-tl-sm border border-neutral-100 dark:border-neutral-800" style={{ width: '50%', gap: 6 }}>
          <Animated.View className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-full" style={{ opacity: pulse, width: '70%' }} />
        </View>
      </View>

      {/* Right message skeleton */}
      <View className="flex-row justify-end" style={{ width: '100%' }}>
        <View className="bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-2xl rounded-tr-sm border border-indigo-100/50 dark:border-indigo-900/30" style={{ width: '55%', gap: 6 }}>
          <Animated.View className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-full" style={{ opacity: pulse, width: '75%' }} />
          <Animated.View className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full" style={{ opacity: pulse, width: '40%' }} />
        </View>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
const MessagesScreen = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId: currentUserId, userRole, isAuthenticated } = useAuth();
  const { contractorProfile } = useContractor();
  const { refreshUnreadMessagesCount, refreshNotifications } = useNotifications();
  const myContractorId = contractorProfile?._id || contractorProfile?.id;

  const recipientId = route.params?.recipientId;
  const recipientName = route.params?.recipientName;
  const conversationId = route.params?.conversationId;

  const [conversations, setConversations] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [editingMessage, setEditingMessage] = useState(null);
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
  const [stripeStatus, setStripeStatus] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const shouldScrollToEndRef = useRef(false);

  const blockedUsersRef = useRef(new Set());
  blockedUsersRef.current = blockedUsers;

  const messagesRef = useRef();
  const selectedConvRef = useRef();
  selectedConvRef.current = selectedConversation;
  const isSendingMessageRef = useRef(false);
  const myTypingTimeoutRef = useRef(null);
  const otherTypingTimeoutRef = useRef(null);
  const lastTypingEmit = useRef(0);

  const chatOther = selectedConversation?.otherParticipant;
  const chatName = getParticipantDisplayName(chatOther) || recipientName || "Chat";
  const chatAvatar = getProfileImageUrl(chatName || "User", chatOther?.profilePicture || route.params?.recipientImage || "");
  const chatOnline = onlineUsers[resolveId(chatOther)] || false;
  const showChat = selectedConversation || route.name === "ChatScreen";

  // ─── Keyboard visibility listener ──────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Clean up outgoing typing timeout on unmount
  useEffect(() => {
    return () => {
      if (myTypingTimeoutRef.current) {
        clearTimeout(myTypingTimeoutRef.current);
      }
    };
  }, []);

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
    (async () => {
      try {
        await registerSocket(currentUserId);
      } catch (err) {
        if (__DEV__) console.warn('registerSocket failed:', err);
      }
    })();

    const handleNewMessage = (msg) => {
      const senderId = resolveId(msg.senderId || msg.sender);
      if (blockedUsersRef.current.has(senderId)) {
        return; // Ignore messages from blocked senders
      }

      const convoId = msg.conversationId || msg.conversation;
      setConversations((prev) => {
        if (!prev[convoId]) {
          loadConversations();
        }
        const convo = prev[convoId] || { conversationId: convoId, _id: convoId, participants: [], messages: [], lastMessage: null, unreadCount: 0 };
        const isFromMe = isMessageFromMe(msg);
        const inc = !isFromMe && selectedConvRef.current?.conversationId !== convoId;
        return { ...prev, [convoId]: { ...convo, lastMessage: msg, unreadCount: inc ? (convo.unreadCount || 0) + 1 : convo.unreadCount } };
      });

      if (selectedConvRef.current && (msg.conversationId === selectedConvRef.current.conversationId || msg.conversation === selectedConvRef.current.conversationId)) {
        shouldScrollToEndRef.current = true;
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;

          // Dedupe: if the socket echoes back a message from the current user
          // that matches a still-pending optimistic message, replace the optimistic
          // one instead of appending a duplicate.
          if (isMessageFromMe(msg)) {
            const msgText = (msg.messageText || '').trim();
            const matchIdx = prev.findIndex((m) => {
              if (!m._isOptimistic) return false;
              if (m.conversationId !== convoId && !m.conversationId?.startsWith('temp-')) return false;
              return (m.messageText || '').trim() === msgText;
            });
            if (matchIdx >= 0) {
              const next = [...prev];
              next[matchIdx] = { ...msg, _isOptimistic: false, _failed: false, __isLocalSent: true };
              return next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            }
          }

          return [...prev, msg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        setTimeout(() => {
          messagesRef.current?.scrollToEnd({ animated: true });
        }, 80);
        if (!isMessageFromMe(msg)) {
          emitMessageRead(msg._id, currentUserId, selectedConvRef.current?.conversationId);
          refreshUnreadMessagesCount();
          refreshNotifications();
          // The message we just rendered may also be the "last message" of
          // its conversation — keep conversations list in sync.
          loadConversations();
        }
      }
    };

    const handleRead = ({ messageId }) => setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, read: true } : m)));

    const handleMessagesRead = ({ conversationId, readerId }) => {
      setMessages((prev) => prev.map((m) => {
        const sId = resolveId(m.senderId);
        if (sId !== readerId) {
          return { ...m, read: true };
        }
        return m;
      }));
    };

    const handleMessageUpdated = (updatedMsg) => {
      setMessages((prev) => prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, isDeleted: true, messageText: 'This message was deleted', attachmentUrl: undefined, quoteId: undefined } : m)));
    };

    const handleTyping = ({ conversationId, userId: typerId }) => {
      if (selectedConvRef.current?.conversationId === conversationId && !myIds.has(resolveId(typerId))) {
        setIsOtherTyping(true);
        clearTimeout(otherTypingTimeoutRef.current);
        otherTypingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), TYPING_TIMEOUT);
      }
    };

    const handleStatus = ({ userId: uid, isOnline }) => setOnlineUsers((prev) => ({ ...prev, [uid]: isOnline }));

    onNewMessage(handleNewMessage);
    onMessageRead(handleRead);
    onMessagesRead(handleMessagesRead);
    onMessageUpdated(handleMessageUpdated);
    onMessageDeleted(handleMessageDeleted);
    onTyping(handleTyping);
    onUserOnlineStatus(handleStatus);

    return () => {
      offNewMessage(handleNewMessage);
      offMessageRead(handleRead);
      offMessagesRead(handleMessagesRead);
      offMessageUpdated(handleMessageUpdated);
      offMessageDeleted(handleMessageDeleted);
      offTyping(handleTyping);
      offUserOnlineStatus(handleStatus);
      leaveConversationSocket(selectedConvRef.current?._id);
      clearTimeout(otherTypingTimeoutRef.current);
    };
  }, [currentUserId, myIds, isMessageFromMe]);

  // ─── Join / leave conversation room ────────────────────────────────────────
  useEffect(() => {
    const cId = selectedConversation?.conversationId;
    const otherId = resolveId(selectedConversation?.otherParticipant);
    if (otherId) {
      try {
        checkOnlineStatus(otherId);
      } catch (err) {
        if (__DEV__) console.warn('checkOnlineStatus failed:', err);
      }
    }
    if (cId && !cId.startsWith("temp-")) {
      (async () => {
        try {
          await joinConversationSocket(cId);
        } catch (err) {
          if (__DEV__) console.warn('joinConversationSocket failed:', err);
        }
      })();
      return () => {
        (async () => {
          try {
            await leaveConversationSocket(cId);
          } catch {}
        })();
      };
    }
  }, [selectedConversation?.conversationId, selectedConversation?.otherParticipant]);

  // ─── Stripe status for contractors ─────────────────────────────────────────
  useEffect(() => {
    if (userRole !== 'contractor') return;
    let mounted = true;
    getStripeAccountStatus()
      .then((status) => { if (mounted) setStripeStatus(status); })
      .catch(() => { if (mounted) setStripeStatus(null); });
    return () => { mounted = false; };
  }, [userRole]);

  // ─── Load blocked users ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    let mounted = true;
    getBlockedUsers()
      .then((users) => {
        if (mounted && Array.isArray(users)) {
          setBlockedUsers(new Set(users.map((u) => resolveId(u))));
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [currentUserId]);

  // ─── Scroll to bottom when keyboard shows ──────────────────────────────────
  useEffect(() => {
    let timerId;
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      // Small delay to let layout settle before scrolling
      timerId = setTimeout(() => {
        messagesRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => {
      showSub.remove();
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  // ─── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId, page = 1) => {
    const targetCId = convId || conversationId;
    if (!targetCId) return;
    if (page === 1) {
      setLoading(true);
      shouldScrollToEndRef.current = true;
    } else {
      setLoadingMoreMessages(true);
    }
    try {
      if (page === 1) {
        // Mark conversation as read on backend, THEN refresh the bell
        // badge and message count. Awaiting is important so the synthetic
        // "new_message" notifications get cleared from the bell.
        const { markConversationAsRead } = await import("../api");
        try { await markConversationAsRead(targetCId); } catch {}
        refreshUnreadMessagesCount();
        refreshNotifications();
      }

      const data = await fetchMessages(targetCId, page, 50);

      // Verify active conversation before applying state update to avoid overwriting list on tab switch
      const activeCId = selectedConvRef.current?.conversationId || selectedConvRef.current?._id;
      if (activeCId && activeCId !== targetCId && !targetCId.startsWith("temp-")) {
        return;
      }
      const msgs = Array.isArray(data) ? data : data?.messages || [];
      const pagination = Array.isArray(data) ? null : data?.pagination;
      const hasMore = pagination ? pagination.hasMore : false;

      setHasMoreMessages(hasMore);
      setMessagesPage(page);

      if (page === 1) {
        setMessages(prev => {
          const optimistic = prev.filter(m => m._isOptimistic && (m.conversationId === targetCId || m.conversationId?.startsWith("temp-")));
          const serverMsgs = [...msgs];
          const combined = [...serverMsgs];
          for (const opt of optimistic) {
            if (!combined.some(c => c._id === opt._id)) {
              combined.push(opt);
            }
          }
          return combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        });
        
        // Immediately clear the unread dot locally to avoid UI lag
        setConversations(prev => ({
          ...prev,
          [targetCId]: {
            ...prev[targetCId],
            unreadCount: 0
          }
        }));
      } else {
        const sortedNew = [...msgs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(prev => [...sortedNew, ...prev]);
      }
    } catch (err) {
      console.error("[Messages] Load error:", err);
    } finally { 
      setLoading(false); 
      setLoadingMoreMessages(false);
    }
  }, [conversationId, currentUserId, refreshUnreadMessagesCount, refreshNotifications]);

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
        if (conversationId) {
          const existing = Object.values(map).find((c) => c.conversationId === conversationId || c._id === conversationId);
          if (existing) setSelectedConversation(existing);
        }
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [currentUserId, recipientId, recipientName, myContractorId, conversationId, selectedConversation, route.params]);

  useEffect(() => { if (currentUserId) loadConversations(); }, [currentUserId, loadConversations]);

  // Auto-select conversation when conversationId is provided (e.g. from notification tap)
  useEffect(() => {
    if (!conversationId) return;
    if (selectedConversation && (selectedConversation.conversationId === conversationId || selectedConversation._id === conversationId)) return;

    const existing = Object.values(conversations).find(
      (c) => c.conversationId === conversationId || c._id === conversationId
    );
    if (existing) {
      setSelectedConversation(existing);
      loadMessages(conversationId);
    } else {
      setSelectedConversation({
        conversationId,
        _id: conversationId,
        otherParticipant: {
          _id: recipientId || 'support',
          firstName: recipientName || 'Ratedeed Support',
          companyName: 'Ratedeed Support',
          isSupport: true,
        },
        messages: [],
        lastMessage: null,
      });
      loadMessages(conversationId);
    }
  }, [conversationId, conversations, selectedConversation, recipientId, recipientName, loadMessages]);

  // Auto-open Quote creation sheet if requested via route params
  useEffect(() => {
    if (route.params?.openQuoteSheet && selectedConversation && userRole === 'contractor') {
      setShowQuoteSheet(true);
      navigation.setParams({ openQuoteSheet: undefined });
    }
  }, [route.params?.openQuoteSheet, selectedConversation, userRole, navigation]);

  // Pre-fill initial message if passed from Quote Request
  useEffect(() => {
    if (route.params?.initialMessage) {
      setNewMessage(route.params.initialMessage);
      navigation.setParams({ initialMessage: undefined });
    }
  }, [route.params?.initialMessage, navigation]);

  // ─── Re-fetch conversations/messages on app foreground ───────────────────────
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === "active") {
        if (currentUserId) {
          loadConversations();
          const cId = selectedConversation?.conversationId || selectedConversation?._id;
          if (cId && !cId.startsWith("temp-")) {
            loadMessages(cId, 1);
          }
        }
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [currentUserId, selectedConversation, loadConversations, loadMessages]);

  useEffect(() => {
    const cId = selectedConversation?.conversationId;
    if (!cId) return;
    setMessagesPage(1);
    setHasMoreMessages(false);
    if (cId.startsWith("temp-")) setMessages([]);
    else loadMessages(cId, 1);
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
    if (isSendingMessageRef.current) return;
    if ((!newMessage.trim() && !pendingAttachment) || !selectedConversation || !currentUserId) return;
    isSendingMessageRef.current = true;
    shouldScrollToEndRef.current = true;
    HapticFeedback.medium();

    // Stop typing indicator
    if (myTypingTimeoutRef.current) {
      clearTimeout(myTypingTimeoutRef.current);
      myTypingTimeoutRef.current = null;
    }
    const stopCId = selectedConversation.conversationId || selectedConversation._id;
    const stopTargetId = resolveId(selectedConversation.otherParticipant);
    emitTyping(stopCId, currentUserId, false, stopTargetId);
    lastTypingEmit.current = 0;

    // If editing an existing message
    if (editingMessage) {
      const messageText = newMessage.trim();
      if (!messageText) return;
      try {
        await updateMessage(editingMessage._id, messageText);
        setMessages(prev => prev.map(m => m._id === editingMessage._id ? { ...m, messageText, isEdited: true } : m));
        setEditingMessage(null);
        setNewMessage("");
      } catch (err) {
        Alert.alert("Error", err?.message || "Failed to update message");
      }
      return;
    }

    // Capture inputs and reset immediately for responsive UX
    const messageText = newMessage.trim();
    const attachment = pendingAttachment;
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setNewMessage("");
    setPendingAttachment(null);

    try {
      let cId = selectedConversation.conversationId || selectedConversation._id;
      let targetId = resolveId(selectedConversation.otherParticipant);

      if (blockedUsersRef.current.has(targetId)) {
        Alert.alert("Blocked", "You cannot send messages to a blocked user.");
        setNewMessage(messageText);
        setPendingAttachment(attachment);
        return;
      }

      if (cId?.startsWith("temp-")) {
        const resp = await createConversation([currentUserId, targetId]);
        cId = resp.conversationId;
        if (resp.participants) {
          setSelectedConversation(prev => ({ ...prev, conversationId: cId, _id: cId, participants: resp.participants }));
        } else {
          setSelectedConversation(prev => ({ ...prev, conversationId: cId, _id: cId }));
        }
      }

      // Create optimistic message (matching web terminology: _isOptimistic, _failed)
      const optimisticMsg = {
        _id: tempId,
        conversationId: cId,
        senderId: currentUserId,
        recipientId: targetId,
        messageText: messageText || null,
        attachmentUrl: attachment ? attachment.uri : null,
        read: false,
        createdAt: new Date().toISOString(),
        _isOptimistic: true,
        _failed: false,
        __isLocalSent: true,
      };

      // Add to messages list
      setMessages((prev) => {
        if (prev.some((m) => m._id === tempId)) return prev;
        return [...prev, optimisticMsg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });

      // Update conversations list lastMessage
      setConversations((prev) => {
        const convo = prev[cId] || { conversationId: cId, _id: cId, participants: [], messages: [], lastMessage: null, unreadCount: 0, otherParticipant: selectedConversation.otherParticipant };
        return { ...prev, [cId]: { ...convo, lastMessage: optimisticMsg } };
      });

      // Launch async message sender
      (async () => {
        let attachmentUrl = null;
        try {
          if (attachment) {
            setIsUploading(true);
            let uploadUri = attachment.uri;
            if (attachment.base64) {
              const mime = attachment.mimeType || 'image/jpeg';
              uploadUri = `data:${mime};base64,${attachment.base64}`;
            }
            attachmentUrl = await uploadToCloudinary(uploadUri, CLOUDINARY_FOLDERS.CHAT);
            setIsUploading(false);
          }

          const sent = await sendMessage(cId, targetId, messageText, attachmentUrl);
          sent.__isLocalSent = true;
          sent._isOptimistic = false;
          sent._failed = false;

          // Replace optimistic message with actual sent message
          setMessages((prev) => {
            return prev.map((m) => (m._id === tempId ? sent : m)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          });

          setConversations((prev) => {
            const convo = prev[sent.conversationId] || { conversationId: sent.conversationId, _id: sent.conversationId, participants: [], messages: [], lastMessage: null, unreadCount: 0, otherParticipant: selectedConversation.otherParticipant };
            return { ...prev, [sent.conversationId]: { ...convo, lastMessage: sent } };
          });
        } catch (e) {
          console.error("Failed to send message optimistically:", e);
          setIsUploading(false);
          // Mark optimistic message as failed
          setMessages((prev) => {
            return prev.map((m) => (m._id === tempId ? { ...m, _failed: true } : m));
          });
        }
      })();

    } catch (e) {
      Alert.alert("Error", e?.message || 'Failed to send message.');
      setNewMessage(messageText);
      setPendingAttachment(attachment);
    } finally {
      isSendingMessageRef.current = false;
    }
  };

  // ─── Retry message ──────────────────────────────────────────────────────────
  const handleRetryMessage = useCallback(async (tempId, messageText, attachmentUri) => {
    // Set status back to sending, failed to false
    setMessages((prev) =>
      prev.map((m) => (m._id === tempId ? { ...m, _isOptimistic: true, _failed: false } : m))
    );

    let cId = selectedConversation.conversationId || selectedConversation._id;
    let targetId = resolveId(selectedConversation.otherParticipant);

    try {
      let attachmentUrl = attachmentUri;
      if (attachmentUri && !attachmentUri.startsWith("http")) {
        setIsUploading(true);
        attachmentUrl = await uploadToCloudinary(attachmentUri, CLOUDINARY_FOLDERS.CHAT);
        setIsUploading(false);
      }

      const sent = await sendMessage(cId, targetId, messageText, attachmentUrl);
      sent.__isLocalSent = true;
      sent._isOptimistic = false;
      sent._failed = false;

      // Replace optimistic message with actual sent message
      setMessages((prev) => {
        return prev.map((m) => (m._id === tempId ? sent : m)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });

      setConversations((prev) => {
        const convo = prev[sent.conversationId] || { conversationId: sent.conversationId, _id: sent.conversationId, participants: [], messages: [], lastMessage: null, unreadCount: 0, otherParticipant: selectedConversation.otherParticipant };
        return { ...prev, [sent.conversationId]: { ...convo, lastMessage: sent } };
      });
    } catch (err) {
      console.error("Retry send failed:", err);
      setIsUploading(false);
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, _isOptimistic: true, _failed: true } : m))
      );
    }
  }, [selectedConversation, currentUserId]);

  const handleMessageLongPress = useCallback((msg) => {
    if (!msg || msg.isDeleted || msg.type === "system") return;
    HapticFeedback.selection();

    const isMe = isMessageFromMe(msg);
    const options = [];

    if (msg.messageText) {
      options.push({
        text: "Copy Text",
        onPress: async () => {
          try {
            await Clipboard.setStringAsync(msg.messageText);
            Alert.alert("Copied", "Message copied to clipboard.");
          } catch {}
        },
      });
    }

    if (isMe && !msg._failed && !msg._isOptimistic) {
      if (msg.messageText && !msg.attachmentUrl) {
        options.push({
          text: "Edit Message",
          onPress: () => {
            setEditingMessage(msg);
            setNewMessage(msg.messageText);
          },
        });
      }

      options.push({
        text: "Delete Message",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Delete Message",
            "Are you sure you want to delete this message?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await deleteMessage(msg._id);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m._id === msg._id
                          ? {
                              ...m,
                              isDeleted: true,
                              messageText: "This message was deleted",
                              attachmentUrl: undefined,
                              quoteId: undefined,
                            }
                          : m
                      )
                    );
                  } catch (err) {
                    Alert.alert("Error", err?.message || "Failed to delete message");
                  }
                },
              },
            ]
          );
        },
      });
    }

    options.push({ text: "Cancel", style: "cancel" });

    Alert.alert("Message Options", undefined, options);
  }, [isMessageFromMe]);

  const handleWithdrawQuote = useCallback((quoteId) => {
    if (!quoteId) return;
    Alert.alert(
      "Withdraw Quote",
      "Are you sure you want to withdraw this quote? The homeowner will no longer be able to accept it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            try {
              await updateQuoteStatus(quoteId, "rejected");
              setMessages((prev) =>
                prev.map((m) =>
                  (m.quote?._id === quoteId || m.quote?.id === quoteId || m.quoteId === quoteId)
                    ? { ...m, quote: { ...m.quote, status: "rejected" } }
                    : m
                )
              );
              HapticFeedback.warning();
              Alert.alert("Quote Withdrawn", "This quote has been successfully withdrawn.");
            } catch (err) {
              Alert.alert("Error", err?.message || "Failed to withdraw quote.");
            }
          },
        },
      ]
    );
  }, []);

  const handleTextChange = useCallback((text) => {
    setNewMessage(text);
    const cId = selectedConversation?.conversationId;
    if (cId && !cId.startsWith("temp-")) {
      if (!text.trim()) {
        if (myTypingTimeoutRef.current) {
          clearTimeout(myTypingTimeoutRef.current);
          myTypingTimeoutRef.current = null;
        }
        const recipientId = resolveId(selectedConversation?.otherParticipant);
        emitTyping(cId, currentUserId, false, recipientId);
        lastTypingEmit.current = 0;
        return;
      }

      const now = Date.now();
      const recipientId = resolveId(selectedConversation?.otherParticipant);
      if (now - lastTypingEmit.current > 3000) {
        emitTyping(cId, currentUserId, true, recipientId);
        lastTypingEmit.current = now;
      }

      if (myTypingTimeoutRef.current) {
        clearTimeout(myTypingTimeoutRef.current);
      }
      myTypingTimeoutRef.current = setTimeout(() => {
        emitTyping(cId, currentUserId, false, recipientId);
        myTypingTimeoutRef.current = null;
        lastTypingEmit.current = 0; // reset throttle on stop
      }, 2000);
    }
  }, [selectedConversation, currentUserId]);

  const pickImage = async () => {
    HapticFeedback.selection();
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert("File too large", "Please choose an image under 5MB.");
        return;
      }
      setPendingAttachment(asset);
    } catch (err) {
      Alert.alert("Error", err?.message || "Failed to select image");
    }
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
      setBlockedUsers((prev) => new Set([...prev, targetId]));
      Alert.alert("Blocked", `${chatName} has been blocked. You will no longer receive messages from them.`);
      setSelectedConversation(null);
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to block user. Please try again.");
    }
  };

  const handleUnblockUser = async () => {
    const targetId = resolveId(selectedConversation?.otherParticipant);
    if (!targetId) {
      Alert.alert("Error", "Unable to unblock user. Please try again.");
      return;
    }
    try {
      await unblockUser(targetId);
      setBlockedUsers((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      Alert.alert("Unblocked", `${chatName} has been unblocked. You can now message them again.`);
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to unblock user. Please try again.");
    }
  };

  const handleHideConversation = async () => {
    const cId = selectedConversation?.conversationId || selectedConversation?._id;
    if (!cId) {
      Alert.alert("Error", "Unable to delete chat. Please try again.");
      return;
    }
    try {
      await deleteConversation(cId);
      setConversations(prev => {
        const copy = { ...prev };
        delete copy[cId];
        return copy;
      });
      setSelectedConversation(null);
      Alert.alert("Success", "Conversation deleted.");
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to delete conversation. Please try again.");
    }
  };

  const handleSelectConversation = useCallback((item) => {
    HapticFeedback.selection();
    setSelectedConversation(item);

    // Optimistically clear the unread badge + conversation's unread count
    // so the bell updates instantly while we sync with the backend.
    const cId = item?.conversationId || item?._id;
    if (cId) {
      setConversations((prev) => prev[cId] ? { ...prev, [cId]: { ...prev[cId], unreadCount: 0 } } : prev);
      refreshUnreadMessagesCount();
      // Mark as read on backend and refresh the notification list so the
      // synthetic "new_message" entries disappear from the bell.
      import("../api").then(({ markConversationAsRead }) => {
        markConversationAsRead(cId).catch(() => {});
      });
      refreshNotifications();
    }
  }, [refreshUnreadMessagesCount, refreshNotifications]);

  const renderMessageItem = useCallback(({ item: msg, index: idx }) => {
    if (msg.type === "system" || resolveId(msg.senderId || msg.sender) === "system") {
      return (
        <View key={msg._id || `s-${idx}`} className="items-center my-4">
          <View className="bg-neutral-200/60 dark:bg-neutral-700/60 px-4 py-1.5 rounded-full">
            <Text className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">{msg.messageText}</Text>
          </View>
        </View>
      );
    }
    const isMe = msg.isMe;
    return (
      <View key={msg._id || `m-${idx}`}>
        {msg.showDate && (
          <View className="items-center my-5">
            <View className="bg-white/80 dark:bg-neutral-800/80 px-4 py-1.5 rounded-full shadow-sm border border-neutral-100/50 dark:border-neutral-700/50">
              <Text className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{formatChatDate(msg.createdAt)}</Text>
            </View>
          </View>
        )}
        <View className={`flex-row ${isMe ? "justify-end" : "justify-start"} ${msg.isFirstInGroup ? "mt-4" : "mt-1"}`}>
          {!isMe && msg.isFirstInGroup ? (
            <View className="w-8 mr-2 mt-1 items-center">
              {isSvgUrl(chatAvatar) ? (
                <View className="w-7 h-7 rounded-full overflow-hidden"><SvgImage uri={chatAvatar} width="100%" height="100%" /></View>
              ) : (
                <Image source={{ uri: chatAvatar }} className="w-7 h-7 rounded-full bg-neutral-100" />
              )}
            </View>
          ) : !isMe ? (
            <View className="w-8 mr-2" />
          ) : null}
          <View className={`${(msg.type === "quote" || msg.quoteId) && msg.quote ? (isMe ? "w-[90%]" : "w-[82%]") : "max-w-[78%]"} ${isMe ? "items-end" : "items-start"}`}>
            {(msg.type === "quote" || msg.quoteId) && msg.quote ? (() => {
              const q = normalizeQuote(msg.quote);
              if (!q) return null;
              const qStatus = q.status || 'pending';
              const isPending = qStatus === 'pending' || qStatus === 'pending_user_approval';
              const quoteId = q._id || q.id || msg.quoteId;
              const contractorPayout = Math.max(0, q.totalAmount - q.platformFee);
              const isMilestone = q.totalAmount >= 5000;
              const isDiagnostic = q.quoteType === 'diagnostic';

              return (
                <>
                  <View className="w-full bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden" style={[{ shadowColor: "#000", shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 10, shadowOffset: { height: 3 }, elevation: isDark ? 0 : 3 }]}>
                    {/* Status Banner when not pending */}
                    {(() => {
                      if (qStatus === 'accepted' || qStatus === 'funded_in_progress') {
                        return (
                          <View className="px-4 py-2.5 flex-row items-center bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40">
                            <FontAwesome5 name="check-circle" size={12} color="#059669" solid />
                            <Text className="text-[12px] font-bold ml-2 text-emerald-800 dark:text-emerald-300">Quote Accepted — Project Confirmed!</Text>
                          </View>
                        );
                      }
                      if (qStatus === 'rejected' || qStatus === 'declined' || qStatus === 'withdrawn' || qStatus === 'cancelled') {
                        return (
                          <View className="px-4 py-2.5 flex-row items-center bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900/40">
                            <FontAwesome5 name="times-circle" size={12} color="#dc2626" solid />
                            <Text className="text-[12px] font-bold ml-2 text-red-800 dark:text-red-300">
                              {isMe ? 'Quote Withdrawn' : 'Quote Declined'}
                            </Text>
                          </View>
                        );
                      }
                      if (qStatus === 'expired') {
                        return (
                          <View className="px-4 py-2.5 flex-row items-center bg-amber-50 dark:bg-amber-950/40 border-b border-amber-100 dark:border-amber-900/40">
                            <FontAwesome5 name="clock" size={12} color="#d97706" />
                            <Text className="text-[12px] font-bold ml-2 text-amber-800 dark:text-amber-300">Quote Expired</Text>
                          </View>
                        );
                      }
                      return null;
                    })()}

                    {/* Header: Homeowner perspective (Contractor Avatar & Info) vs Contractor perspective (Project Quote badge) */}
                    {!isMe ? (
                      <View className="p-4 pb-3 flex-row items-center border-b border-neutral-100 dark:border-neutral-700/60" style={{ gap: 12 }}>
                        {(() => {
                          const contractorName = q.contractor?.companyName || q.contractor?.businessName || selectedConversation?.otherParticipant?.companyName || selectedConversation?.otherParticipant?.firstName || 'Contractor';
                          const contractorAvatar = getProfileImageUrl(contractorName, q.contractor?.profilePicture || selectedConversation?.otherParticipant?.profilePicture || '', q.contractor?.category || selectedConversation?.otherParticipant?.category);
                          const isVerified = q.contractor?.isVerified || selectedConversation?.otherParticipant?.isVerified || selectedConversation?.otherParticipant?.isTopRated;
                          const rating = q.contractor?.averageRating || selectedConversation?.otherParticipant?.averageRating || '5.0';
                          const city = q.contractor?.city || selectedConversation?.otherParticipant?.city || '';

                          return (
                            <>
                              {isSvgUrl(contractorAvatar) ? (
                                <View className="w-11 h-11 rounded-full overflow-hidden shrink-0">
                                  <SvgImage uri={contractorAvatar} width="100%" height="100%" />
                                </View>
                              ) : (
                                <Image source={{ uri: contractorAvatar }} className="w-11 h-11 rounded-full bg-neutral-100 dark:bg-neutral-700 shrink-0" />
                              )}
                              <View className="flex-1 min-w-0">
                                <View className="flex-row items-center" style={{ gap: 4 }}>
                                  <Text className="text-[14px] font-bold text-neutral-900 dark:text-white truncate" numberOfLines={1}>{contractorName}</Text>
                                  {isVerified && <VerifiedBadge size={13} animate={false} />}
                                </View>
                                <View className="flex-row items-center mt-0.5" style={{ gap: 8 }}>
                                  <View className="flex-row items-center" style={{ gap: 3 }}>
                                    <FontAwesome5 name="star" size={10} color="#eab308" solid />
                                    <Text className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">{rating}</Text>
                                  </View>
                                  {city ? (
                                    <View className="flex-row items-center" style={{ gap: 3 }}>
                                      <FontAwesome5 name="map-marker-alt" size={9} color="#9ca3af" />
                                      <Text className="text-[11px] text-neutral-400 truncate" numberOfLines={1}>{city}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            </>
                          );
                        })()}
                      </View>
                    ) : (
                      <View className="p-3.5 pb-2.5 flex-row items-center justify-between border-b border-neutral-100 dark:border-neutral-700/60">
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                          <FontAwesome5 name="file-invoice-dollar" size={13} color="#4F46E5" />
                          <Text className="text-[13px] font-bold text-neutral-900 dark:text-white">Project Quote Sent</Text>
                        </View>
                        {isPending && (
                          <View className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40">
                            <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Awaiting Response</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Body Content */}
                    <View className="p-4 pb-2">
                      {/* Category & Badges */}
                      <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                        <View className={`px-2 py-0.5 rounded ${isDiagnostic ? (isDark ? 'bg-indigo-900/50' : 'bg-indigo-50') : (isDark ? 'bg-neutral-700' : 'bg-neutral-100')}`}>
                          <Text className={`text-[10px] font-bold uppercase tracking-wider ${isDiagnostic ? 'text-indigo-600 dark:text-indigo-300' : 'text-neutral-800 dark:text-neutral-200'}`}>
                            {isDiagnostic ? '📋 Diagnostic Dispatch' : (q.serviceType || q.category || 'Service')}
                          </Text>
                        </View>
                        {q.diagnosticFeeCredit > 0 && (
                          <View className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40">
                            <Text className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              ✓ ${q.diagnosticFeeCredit.toFixed(0)} Credit Applied
                            </Text>
                          </View>
                        )}
                        {q.revisions > 0 && (
                          <View className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40">
                            <Text className="text-[10px] font-bold text-purple-700 dark:text-purple-300">Revision #{q.revisions}</Text>
                          </View>
                        )}
                      </View>

                      {/* Project Title & Scope */}
                      <Text className="text-[17px] font-bold text-neutral-900 dark:text-white mt-2 leading-[22px]">
                        {q.projectName || q.projectTitle || q.title || 'Project Quote'}
                      </Text>

                      {q.description ? (
                        <Text className="text-[13px] text-neutral-600 dark:text-neutral-300 mt-1 leading-[18px]" numberOfLines={4}>
                          {q.description}
                        </Text>
                      ) : null}

                      {/* Timeline / Dates */}
                      {(() => {
                        const startDateStr = q.startDate || q.estimatedStartDate;
                        const durationStr = q.estimatedDuration;
                        const formattedStart = startDateStr ? (() => {
                          try {
                            const d = new Date(startDateStr);
                            return !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : String(startDateStr);
                          } catch { return null; }
                        })() : null;

                        if (!formattedStart && !durationStr) return null;

                        return (
                          <View className="flex-row items-center mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-700/50" style={{ gap: 14 }}>
                            {formattedStart && (
                              <View className="flex-row items-center" style={{ gap: 5 }}>
                                <FontAwesome5 name="calendar-alt" size={11} color="#6b7280" />
                                <Text className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">Start: {formattedStart}</Text>
                              </View>
                            )}
                            {durationStr && (
                              <View className="flex-row items-center" style={{ gap: 5 }}>
                                <FontAwesome5 name="clock" size={11} color="#6b7280" />
                                <Text className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{durationStr}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </View>

                    {/* Line Items */}
                    {Array.isArray(q.lineItems) && q.lineItems.length > 0 && (
                      <View className="px-4 py-2.5 mx-4 mb-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60" style={{ gap: 6 }}>
                        {q.lineItems.slice(0, 4).map((item, i) => (
                          <View key={i} className="flex-row justify-between items-center">
                            <Text className="text-[12px] text-neutral-600 dark:text-neutral-300 flex-1 mr-2" numberOfLines={1}>
                              {item.description || item.label || `Item ${i + 1}`}
                            </Text>
                            <Text className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-200">
                              ${(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                          </View>
                        ))}
                        {q.lineItems.length > 4 && (
                          <Text className="text-[11px] text-neutral-400 font-medium">+ {q.lineItems.length - 4} more items</Text>
                        )}
                      </View>
                    )}

                    {/* Financial Breakdown */}
                    <View className="px-4 py-2.5 mx-4 mb-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60" style={{ gap: 5 }}>
                      {q.diagnosticFeeCredit > 0 && (
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[12px] text-emerald-700 dark:text-emerald-300 font-medium">Diagnostic Fee Credit</Text>
                          <Text className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                            -${q.diagnosticFeeCredit.toFixed(2)}
                          </Text>
                        </View>
                      )}

                      {isMe && q.platformFee > 0 && (
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">RateDeed Platform Fee (5%)</Text>
                          <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">
                            -${q.platformFee.toFixed(2)}
                          </Text>
                        </View>
                      )}

                      <View className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />

                      <View className="flex-row justify-between items-center">
                        <Text className="text-[14px] font-bold text-neutral-900 dark:text-white">
                          {isMe ? 'Total Project Price' : 'Total Price'}
                        </Text>
                        <Text className="text-[18px] font-extrabold text-neutral-900 dark:text-white">
                          ${q.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>

                      {isMe && (
                        <View className="flex-row justify-between items-center pt-1 mt-0.5 border-t border-neutral-200/60 dark:border-neutral-800">
                          <Text className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400">Your Net Payout</Text>
                          <Text className="text-[13px] font-extrabold text-indigo-600 dark:text-indigo-400">
                            ${contractorPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Escrow / Guarantee Notice */}
                    {isDiagnostic ? (
                      <View className="mx-4 mb-3.5 p-3 rounded-xl flex-row items-start bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40" style={{ gap: 8 }}>
                        <FontAwesome5 name="shield-alt" size={13} color="#4F46E5" style={{ marginTop: 2 }} />
                        <Text className="text-[11px] flex-1 leading-[16px] text-indigo-900 dark:text-indigo-200">
                          Diagnostic Fee Protection: This fee will be 100% credited toward your final repair quote if you proceed.
                        </Text>
                      </View>
                    ) : isMilestone ? (
                      <View className="mx-4 mb-3.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                        <View className="flex-row items-center mb-1.5" style={{ gap: 6 }}>
                          <FontAwesome5 name="shield-alt" size={12} color="#4F46E5" />
                          <Text className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">Milestone Escrow Applied</Text>
                        </View>
                        <View className="flex-row justify-between text-[11px] pt-1 border-t border-indigo-200/50 dark:border-indigo-800/40">
                          <Text className="text-[10px] text-indigo-700 dark:text-indigo-300">Deposit 30% (${(q.totalAmount * 0.3).toFixed(0)})</Text>
                          <Text className="text-[10px] text-indigo-700 dark:text-indigo-300">Midpoint 30% (${(q.totalAmount * 0.3).toFixed(0)})</Text>
                          <Text className="text-[10px] text-indigo-700 dark:text-indigo-300">Completion 40% (${(q.totalAmount * 0.4).toFixed(0)})</Text>
                        </View>
                      </View>
                    ) : (
                      <View className="mx-4 mb-3.5 p-3 rounded-xl flex-row items-start bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/60 dark:border-neutral-700" style={{ gap: 8 }}>
                        <FontAwesome5 name="shield-alt" size={12} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginTop: 2 }} />
                        <Text className="text-[11px] flex-1 leading-[16px] text-neutral-600 dark:text-neutral-300">
                          {isMe
                            ? 'Funds are held safely in escrow and released to you once the homeowner verifies the work is complete.'
                            : 'Payments are held safely in escrow and only released when you verify the work is completed.'}
                        </Text>
                      </View>
                    )}

                    {/* Expiration Countdown Banner (when active) */}
                    {(() => {
                      const expiryText = isPending ? getQuoteExpiryDisplay(q.expiresAt) : null;
                      if (!expiryText || expiryText === 'Expired') return null;

                      return (
                        <View className="mx-4 mb-3 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex-row items-center" style={{ gap: 6 }}>
                          <FontAwesome5 name="clock" size={11} color="#d97706" />
                          <Text className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">{expiryText}</Text>
                        </View>
                      );
                    })()}

                    {/* Action Buttons */}
                    <View className="px-4 pb-4">
                      {isMe ? (
                        (() => {
                          if (isPending) {
                            return (
                              <View className="flex-row items-center" style={{ gap: 8 }}>
                                <Pressable
                                  onPress={() => handleWithdrawQuote(quoteId)}
                                  className="flex-1 py-3 rounded-xl items-center justify-center border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 active:opacity-70"
                                  accessibilityLabel="Withdraw quote"
                                  accessibilityRole="button"
                                >
                                  <Text className="text-[13px] font-bold text-red-600 dark:text-red-400">Withdraw</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => navigation.navigate('QuoteReview', { quoteId })}
                                  className="flex-1 py-3 bg-neutral-900 dark:bg-neutral-100 rounded-xl items-center justify-center active:opacity-80"
                                  accessibilityLabel="View quote details"
                                  accessibilityRole="button"
                                >
                                  <Text className="text-[13px] font-bold text-white dark:text-neutral-900">View Quote</Text>
                                </Pressable>
                              </View>
                            );
                          }

                          if (qStatus === 'accepted' || qStatus === 'funded_in_progress') {
                            return (
                              <Pressable
                                onPress={() => navigation.navigate('JobDetail', { quoteId })}
                                className="py-3.5 bg-emerald-600 rounded-xl items-center justify-center flex-row"
                                style={{ gap: 6 }}
                                accessibilityLabel="View active job"
                                accessibilityRole="button"
                              >
                                <Text className="text-[14px] font-bold text-white">View Active Job</Text>
                                <FontAwesome5 name="arrow-right" size={11} color="white" />
                              </Pressable>
                            );
                          }

                          return (
                            <Pressable
                              onPress={() => navigation.navigate('QuoteReview', { quoteId })}
                              className="py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl items-center justify-center"
                              accessibilityLabel="View quote details"
                              accessibilityRole="button"
                            >
                              <Text className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">View Quote Details</Text>
                            </Pressable>
                          );
                        })()
                      ) : (
                        (() => {
                          if (isPending) {
                            return (
                              <Pressable
                                onPress={() => navigation.navigate('QuoteReview', { quoteId })}
                                className="py-3.5 bg-neutral-900 dark:bg-neutral-100 rounded-xl items-center flex-row justify-center active:opacity-85"
                                style={{ gap: 6 }}
                                accessibilityLabel="Review and accept quote"
                                accessibilityRole="button"
                              >
                                <Text className="text-[14px] font-bold text-white dark:text-neutral-900">Review & Accept Quote</Text>
                                <FontAwesome5 name="arrow-right" size={11} color={isDark ? "#171717" : "#FFFFFF"} />
                              </Pressable>
                            );
                          }

                          if (qStatus === 'accepted' || qStatus === 'funded_in_progress') {
                            return (
                              <Pressable
                                onPress={() => navigation.navigate('JobDetail', { quoteId })}
                                className="py-3.5 bg-emerald-600 rounded-xl items-center justify-center flex-row"
                                style={{ gap: 6 }}
                                accessibilityLabel="View active job and escrow"
                                accessibilityRole="button"
                              >
                                <Text className="text-[14px] font-bold text-white">View Active Job & Escrow</Text>
                                <FontAwesome5 name="arrow-right" size={11} color="white" />
                              </Pressable>
                            );
                          }

                          return (
                            <Pressable
                              onPress={() => navigation.navigate('QuoteReview', { quoteId })}
                              className="py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl items-center justify-center"
                              accessibilityLabel="View quote details"
                              accessibilityRole="button"
                            >
                              <Text className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">View Quote Details</Text>
                            </Pressable>
                          );
                        })()
                      )}
                    </View>
                  </View>
                  {(msg.isLastInGroup || msg._failed) && (
                    <View className={`flex-row items-center mt-1.5 px-1 ${isMe ? "justify-end" : "justify-start"}`} style={{ gap: 4 }}>
                      {msg._failed && (
                        <View className="flex-row items-center mr-1" style={{ gap: 4 }}>
                          <FontAwesome5 name="exclamation-circle" size={10} color="#ef4444" />
                          <Text className="text-[10px] text-red-500 font-semibold">Failed</Text>
                          <Pressable onPress={() => handleRetryMessage(msg._id, msg.messageText, msg.attachmentUrl)}>
                            <Text className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold underline">Retry</Text>
                          </Pressable>
                        </View>
                      )}
                      <Text className="text-[10px] text-neutral-400 font-medium">{msg.timeStr || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "")}</Text>
                      {isMe && !msg._isOptimistic && !msg._failed && <FontAwesome5 name={msg.read ? "check-double" : "check"} size={9} color={msg.read ? "#4F46E5" : "#4F46E5"} solid={msg.read} />}
                    </View>
                  )}
                </>
              );
            })() : (msg.type === "change_order" || msg.changeOrderId) && (msg.changeOrder || msg.changeOrderId) ? (
              <>
                <View className="w-full bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4" style={[{ shadowColor: "#000", shadowOpacity: isDark ? 0 : 0.04, shadowRadius: 10, shadowOffset: { height: 3 }, elevation: isDark ? 0 : 3 }]}>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <FontAwesome5 name="file-invoice-dollar" size={14} color="#f59e0b" />
                      <Text className="text-[13px] font-bold text-neutral-900 dark:text-white">Change Order</Text>
                    </View>
                    {msg.changeOrder?.amount != null ? (
                      <Text className="text-[14px] font-extrabold text-neutral-900 dark:text-white">
                        {msg.changeOrder.amount >= 0 ? `+$${(msg.changeOrder.amount / 100).toFixed(2)}` : `-$${(Math.abs(msg.changeOrder.amount) / 100).toFixed(2)}`}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-[13px] text-neutral-800 dark:text-neutral-200 font-semibold mb-1">
                    {msg.changeOrder?.title || msg.messageText}
                  </Text>
                  {msg.changeOrder?.description ? (
                    <Text className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-3" numberOfLines={3}>
                      {msg.changeOrder.description}
                    </Text>
                  ) : null}
                  <View className="py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 flex-row items-center" style={{ gap: 6 }}>
                    <FontAwesome5 name="info-circle" size={11} color="#6b7280" />
                    <Text className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium">
                      {msg.changeOrder?.status === 'accepted' ? 'Accepted by homeowner' : msg.changeOrder?.status === 'declined' ? 'Declined' : 'Pending review'}
                    </Text>
                  </View>
                </View>
                {(msg.isLastInGroup || msg._failed) && (
                  <View className={`flex-row items-center mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`} style={{ gap: 4 }}>
                    <Text className="text-[10px] text-neutral-400 font-medium">{msg.timeStr || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "")}</Text>
                    {isMe && !msg._isOptimistic && !msg._failed && <FontAwesome5 name={msg.read ? "check-double" : "check"} size={9} color={msg.read ? "#4F46E5" : "#4F46E5"} solid={msg.read} />}
                  </View>
                )}
              </>
            ) : (
              <>
                <Pressable
                  onLongPress={() => handleMessageLongPress(msg)}
                  delayLongPress={300}
                  className={`px-[16px] py-[11px] ${isMe ? `bg-neutral-900 ${msg.isFirstInGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl"}` : `bg-neutral-100 dark:bg-neutral-800 ${msg.isFirstInGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl"}`}`}
                  style={[!isMe ? { shadowColor: isDark ? "transparent" : "#000", shadowOpacity: isDark ? 0 : 0.02, shadowRadius: 6, shadowOffset: { height: 1 }, elevation: isDark ? 0 : 1 } : undefined]}
                >
                  {msg.attachmentUrl && isImageAttachment(msg.attachmentUrl) && <Pressable onPress={() => { setActiveImage(msg.attachmentUrl); setLightboxVisible(true); }} className="mb-1.5 -mx-[2px] -mt-[2px] overflow-hidden" style={{ borderRadius: msg.isFirstInGroup ? 14 : 16 }}><Image source={{ uri: msg.attachmentUrl }} style={{ width: 240, height: 180 }} resizeMode="cover" /></Pressable>}
                  {msg.attachmentUrl && !isImageAttachment(msg.attachmentUrl) && <Pressable onPress={() => Linking.openURL(msg.attachmentUrl)} className={`flex-row items-center p-2.5 rounded-xl mb-1.5 border ${isMe ? "bg-white/10 border-white/20" : "bg-neutral-50 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600"}`}><FontAwesome5 name="file-alt" size={14} color={isMe ? "white" : (isDark ? "#a3a3a3" : "#737373")} /><Text className={`text-[12px] ml-2 font-semibold ${isMe ? "text-white" : "text-neutral-600 dark:text-neutral-300"}`}>View Attachment</Text></Pressable>}
                  {msg.messageText ? <Text className={`text-[15px] leading-[22px] ${isMe ? "text-white" : "text-neutral-800 dark:text-neutral-100"}`}>{msg.messageText}</Text> : null}
                  {msg.isEdited && <Text className="text-[9px] text-neutral-400 italic mt-0.5">Edited</Text>}
                </Pressable>
                {(msg.isLastInGroup || msg._failed) && (
                  <View className={`flex-row items-center mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`} style={{ gap: 4 }}>
                    {msg._failed && (
                      <View className="flex-row items-center mr-1" style={{ gap: 4 }}>
                        <FontAwesome5 name="exclamation-circle" size={10} color="#ef4444" />
                        <Text className="text-[10px] text-red-500 font-semibold">Failed</Text>
                        <Pressable onPress={() => handleRetryMessage(msg._id, msg.messageText, msg.attachmentUrl)}>
                          <Text className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold underline">Retry</Text>
                        </Pressable>
                      </View>
                    )}
                    <Text className="text-[10px] text-neutral-400 font-medium">{msg.timeStr || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "")}</Text>
                    {isMe && !msg._isOptimistic && !msg._failed && <FontAwesome5 name={msg.read ? "check-double" : "check"} size={9} color={msg.read ? "#4F46E5" : "#4F46E5"} solid={msg.read} />}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    );
  }, [chatAvatar, chatName, isDark, navigation, setActiveImage, setLightboxVisible, handleRetryMessage, handleMessageLongPress, handleWithdrawQuote]);

  const filteredConversations = useMemo(() => {
    return Object.values(conversations)
      .filter((c) => c.lastMessage)
      .filter((c) => !searchQuery || (getParticipantDisplayName(c.otherParticipant) || "").toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  }, [conversations, searchQuery]);



  // If deep-linked to ChatScreen but no conversation loaded yet, redirect back
  useEffect(() => {
    if (route.name === "ChatScreen" && !selectedConversation && !loading && Object.values(conversations).length > 0) {
      if (conversationId) {
        const target = Object.values(conversations).find(c => c.conversationId === conversationId || c._id === conversationId);
        if (target) {
          setSelectedConversation(target);
          return;
        }
      }
      if (recipientId) {
        const target = Object.values(conversations).find(c => collectAllIds(c.otherParticipant).includes(resolveId(recipientId)));
        if (target) {
          setSelectedConversation(target);
          return;
        }
        setSelectedConversation({
          conversationId: `temp-${Date.now()}`,
          otherParticipant: {
            _id: recipientId,
            firstName: recipientName || "User",
            role: route.params?.recipientRole || "User",
            profilePicture: route.params?.recipientImage || ""
          },
          messages: [],
          lastMessage: null
        });
        return;
      }
      if (conversationId) {
        Alert.alert("Conversation Not Found", "The requested chat could not be found or may have been removed.");
      }
    }
  }, [route.name, selectedConversation, loading, conversations, conversationId, recipientId, recipientName]);

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
              <BouncingRefreshFlatList data={filteredConversations} keyExtractor={(c) => c.conversationId || c._id} renderItem={({ item }) => <ConversationItem conv={item} currentUserId={currentUserId} onlineUsers={onlineUsers} onPress={handleSelectConversation} />} ItemSeparatorComponent={() => <View className="ml-[82px] border-b border-neutral-100 dark:border-neutral-800" />} refreshing={refreshing} onRefresh={() => loadConversations(true)} loaderColor="#818CF8" contentContainerStyle={{ paddingBottom: 20 }} />
            )}
          </View>
        ) : (
          <View className="flex-1">
            <View className="px-4 py-3 flex-row items-center bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800/80" style={{ gap: 12 }}>
              <Pressable onPress={() => { if (route.name === "ChatScreen") navigation.goBack(); else setSelectedConversation(null); }} className="w-11 h-11 items-center justify-center rounded-full -ml-1" accessibilityLabel="Go back" accessibilityRole="button">
                <FontAwesome5 name="chevron-left" size={16} color={isDark ? "#e5e5e5" : "#171717"} />
              </Pressable>
              <View className="relative">
                {loading && !selectedConversation ? (
                  <View className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                ) : isSvgUrl(chatAvatar) ? (
                  <View className="w-10 h-10 rounded-full overflow-hidden"><SvgImage uri={chatAvatar} width="100%" height="100%" /></View>
                ) : (
                  <Image source={{ uri: chatAvatar }} className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-700" />
                )}
                {chatOnline && (
                  <View className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-neutral-900" />
                )}
              </View>
              <View className="flex-1 min-w-0">
                {loading && !selectedConversation ? (
                  <View className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24 mt-1" />
                ) : (
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Text className="text-[15px] font-bold text-neutral-900 dark:text-white truncate" numberOfLines={1}>{chatName}</Text>
                    {chatOther?.role === "contractor" && (chatOther?.isVerified || chatOther?.isTopRated) && <VerifiedBadge size={14} animate={false} />}
                  </View>
                )}
              </View>
              <Pressable onPress={() => setActionSheetVisible(true)} className="w-11 h-11 items-center justify-center rounded-full" accessibilityLabel="Chat options" accessibilityRole="button"><FontAwesome5 name="ellipsis-h" size={16} color={isDark ? "#a3a3a3" : "#525252"} /></Pressable>
            </View>
            
            {loading && processedMessages.length === 0 ? (
              <MessageBubbleSkeleton />
            ) : (
              <FlatList
                ref={messagesRef}
                data={processedMessages}
              renderItem={renderMessageItem}
              keyExtractor={(item, idx) => item._id || `msg-${idx}`}
              className="flex-1 bg-neutral-50/60 dark:bg-neutral-950/60"
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
              onContentSizeChange={() => {
                if (shouldScrollToEndRef.current) {
                  messagesRef.current?.scrollToEnd({ animated: false });
                  shouldScrollToEndRef.current = false;
                }
              }}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                setShowScrollBtn(contentSize.height - layoutMeasurement.height - contentOffset.y > 300);
              }}
              scrollEventThrottle={64}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
              ListFooterComponent={isOtherTyping ? <TypingIndicator name={chatName?.split(" ")[0]} /> : null}
              ListHeaderComponent={
                loading ? (
                  <View className="items-center py-10"><BouncingDotsLoader size="small" color="#818CF8" /></View>
                ) : hasMoreMessages ? (
                  <View className="items-center py-4">
                    <Pressable
                      onPress={() => loadMessages(selectedConversation?.conversationId || selectedConversation?._id, messagesPage + 1)}
                      disabled={loadingMoreMessages}
                      className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full active:opacity-60"
                    >
                      {loadingMoreMessages ? (
                        <BouncingDotsLoader size="small" color="#818CF8" />
                      ) : (
                        <Text className="text-[12px] font-semibold text-neutral-600 dark:text-neutral-300">Load older messages</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null
              }
            />
            )}

            {showScrollBtn && <Pressable onPress={() => { HapticFeedback.selection(); messagesRef.current?.scrollToEnd({ animated: true }); }} className="absolute bottom-24 right-4 w-11 h-11 bg-white dark:bg-neutral-800 rounded-full items-center justify-center shadow-lg" style={{ shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 5 }} accessibilityLabel="Scroll to bottom" accessibilityRole="button"><FontAwesome5 name="chevron-down" size={12} color={isDark ? "#a3a3a3" : "#525252"} /></Pressable>}

            {pendingAttachment && <View className="px-4 py-2.5 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 flex-row items-center justify-between"><View className="flex-row items-center" style={{ gap: 10 }}><Image source={{ uri: pendingAttachment.uri }} className="w-12 h-12 rounded-xl" /><View><Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">Image ready to send</Text><Text className="text-[10px] text-neutral-400 dark:text-neutral-500">Tap send to share</Text></View></View><Pressable onPress={() => setPendingAttachment(null)} className="w-7 h-7 bg-neutral-100 dark:bg-neutral-700 rounded-full items-center justify-center"><FontAwesome5 name="times" size={10} color={isDark ? "#a3a3a3" : "#525252"} /></Pressable></View>}

            <View className="px-4 py-3 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800 flex-row items-end" style={{ gap: 8, paddingBottom: keyboardVisible ? 12 : (insets.bottom + 12 || 12) }}>
              <Pressable onPress={pickImage} className="w-11 h-11 items-center justify-center rounded-full bg-neutral-50 dark:bg-neutral-800" accessibilityLabel="Attach image" accessibilityRole="button"><FontAwesome5 name="image" size={15} color={isDark ? "#a3a3a3" : "#737373"} /></Pressable>
              
              {(() => {
                const isContractor = userRole === 'contractor' || !!contractorProfile?._id;
                const hasConversation = !!(selectedConversation?.conversationId || selectedConversation?._id);
                const chargesEnabled = stripeStatus?.chargesEnabled || contractorProfile?.stripeAccountChargesEnabled || contractorProfile?.chargesEnabled;

                if (isContractor && hasConversation) {
                  return (
                    <Pressable
                      onPress={() => {
                        if (!chargesEnabled) {
                          Alert.alert(
                            'Connect to Stripe',
                            "You'll need a connected Stripe account with active charges enabled before you can create and send quotes to clients. Tapping 'Go to Payments' will take you there.",
                            [
                              { text: 'Not now', style: 'cancel' },
                              { text: 'Go to Payments', onPress: () => navigation.navigate('ContractorDashboard', { initialTab: 'payments' }) }
                            ]
                          );
                        } else {
                          setShowQuoteSheet(true);
                        }
                      }}
                      className="w-11 h-11 items-center justify-center rounded-full bg-indigo-50"
                      accessibilityLabel="Send quote"
                      accessibilityRole="button"
                    >
                      <FontAwesome5 
                        name="tag" 
                        size={13} 
                        color={chargesEnabled ? "#4F46E5" : "#94a3b8"} 
                      />
                    </Pressable>
                  );
                }
                return null;
              })()}

              <View className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-2.5 max-h-[120px]"><TextInput className="text-[15px] text-neutral-800 dark:text-neutral-200 leading-5" maxLength={500} placeholder="Type a message..." placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"} value={newMessage} onChangeText={handleTextChange} multiline style={{ maxHeight: 100 }} accessibilityLabel="Message input" accessibilityRole="text" /></View>
              {newMessage.length > 0 && (
                <Text className={`text-[10px] select-none mr-1 mb-3 self-end ${newMessage.length >= 450 ? 'text-red-500 font-semibold' : 'text-neutral-400'}`}>
                  {newMessage.length}/500
                </Text>
              )}
              <Pressable onPress={handleSendMessage} disabled={(!newMessage.trim() && !pendingAttachment) || isUploading} className={`w-11 h-11 rounded-full items-center justify-center mb-0.5 ${newMessage.trim() || pendingAttachment ? "bg-indigo-600" : "bg-neutral-200 dark:bg-neutral-700"}`} style={newMessage.trim() || pendingAttachment ? { shadowColor: "#4F46E5", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 3 } : undefined} accessibilityLabel="Send message" accessibilityRole="button">
                {isUploading ? <BouncingDotsLoader size="small" color="white" /> : <FontAwesome5 name="paper-plane" size={14} color={newMessage.trim() || pendingAttachment ? "white" : (isDark ? "#737373" : "#a3a3a3")} />}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <ImageLightbox images={activeImage ? [activeImage] : []} visible={lightboxVisible} onClose={() => setLightboxVisible(false)} />
      
      <ActionSheet visible={actionSheetVisible} onClose={() => setActionSheetVisible(false)} title="Chat Options" options={[
        { id: "hide", label: "Delete Chat", icon: "trash-alt", isDestructive: true, onPress: () => { setActionSheetVisible(false); Alert.alert("Delete Chat", "Are you sure you want to delete this chat? It will hide the conversation until a new message is received.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: handleHideConversation }]); } },
        { id: "report", label: "Report User", icon: "flag", isDestructive: true, onPress: () => { setActionSheetVisible(false); setTimeout(() => setReportModalVisible(true), 300); } },
        blockedUsers.has(resolveId(selectedConversation?.otherParticipant))
          ? { id: "unblock", label: "Unblock User", icon: "user-check", onPress: () => Alert.alert("Unblock User", `Are you sure you want to unblock ${chatName}?`, [{ text: "Cancel", style: "cancel" }, { text: "Unblock", onPress: handleUnblockUser }]) }
          : { id: "block", label: "Block User", icon: "ban", isDestructive: true, onPress: () => Alert.alert("Block User", `Are you sure you want to block ${chatName}? You will no longer receive messages from them.`, [{ text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: handleBlockUser }]) }
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
          category={contractorProfile?.category || ''}
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