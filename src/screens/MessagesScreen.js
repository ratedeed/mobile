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
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
} from "../api";
import { useAuth } from "../context/AuthContext";
import { useContractor } from "../context/ContractorContext";
import { SvgImage } from "../components/common/SvgImage";
import { getProfileImageUrl, isSvgUrl } from "../utils/avatarUtils";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../utils/cloudinary";
import ActionSheet from "../components/common/ActionSheet";
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

/** Extracts ALL possible IDs from a message sender */
const collectSenderIds = (msg) => {
  const ids = new Set();
  const addIds = (obj) => collectAllIds(obj).forEach((id) => ids.add(id));
  if (msg.senderId) addIds(msg.senderId);
  if (msg.sender) addIds(msg.sender);
  if (msg.sentBy) addIds(msg.sentBy);
  if (msg.from) addIds(msg.from);
  return [...ids];
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
      <View className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm flex-row items-center" style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 2 }}>
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
    <Text className="text-xl font-bold text-neutral-800 text-center mb-2">No messages yet</Text>
    <Text className="text-sm text-neutral-400 text-center leading-5">When you connect with contractors, your conversations will appear here.</Text>
  </View>
);

// ─── Report Modal ─────────────────────────────────────────────────────────────
const ReportModal = ({ visible, onClose, userName, onReport }) => {
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try { await onReport(selected, details); setSelected(null); setDetails(""); onClose(); } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="px-5 pt-14 pb-4 border-b border-neutral-100 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-neutral-900">Report</Text>
          <Pressable onPress={onClose} className="p-1"><FontAwesome5 name="times" size={18} color="#737373" /></Pressable>
        </View>
        <Text className="px-5 pt-5 pb-2 text-sm text-neutral-500">Why are you reporting {userName}?</Text>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          {REPORT_CATEGORIES.map((cat) => (
            <Pressable key={cat} onPress={() => setSelected(cat)} className="flex-row items-center px-5 py-4 border-b border-neutral-50" style={{ gap: 12 }}>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${selected === cat ? "border-red-500 bg-red-500" : "border-neutral-300"}`}>
                {selected === cat && <FontAwesome5 name="check" size={9} color="white" />}
              </View>
              <Text className={`text-[15px] ${selected === cat ? "text-neutral-900 font-semibold" : "text-neutral-700"}`}>{cat}</Text>
            </Pressable>
          ))}
          {selected && (
            <View className="px-5 pt-5">
              <Text className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Additional details (optional)</Text>
              <TextInput className="bg-neutral-50 rounded-xl px-4 py-3 text-sm min-h-[80px]" placeholder="Tell us more..." placeholderTextColor="#a3a3a3" value={details} onChangeText={setDetails} multiline textAlignVertical="top" />
            </View>
          )}
        </ScrollView>
        {selected && (
          <View className="px-5 pb-10 pt-3 border-t border-neutral-100">
            <Pressable onPress={handleSubmit} disabled={submitting} className={`py-4 rounded-xl items-center ${submitting ? "bg-red-300" : "bg-red-500"}`}>
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
    <Pressable onPress={onPress} className="flex-row items-center px-5 py-3.5 active:bg-neutral-50" style={{ gap: 14 }}>
      <View className="relative shrink-0">
        {isSvgUrl(avatarUrl) ? (
          <View className="w-[54px] h-[54px] rounded-full overflow-hidden"><SvgImage uri={avatarUrl} width="100%" height="100%" /></View>
        ) : (
          <Image source={{ uri: avatarUrl }} className="w-[54px] h-[54px] rounded-full bg-neutral-100" />
        )}
        {isOnline && <View className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-[2.5px] border-white" />}
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1" style={{ gap: 5 }}>
            <Text className={`text-[15px] truncate ${conv.unreadCount > 0 ? "font-bold text-neutral-900" : "font-semibold text-neutral-800"}`} numberOfLines={1}>{displayName}</Text>
            {other?.role === "contractor" && (other?.isVerified || other?.isTopRated) && <VerifiedBadge size={13} animate={false} />}
          </View>
          <Text className={`text-[11px] shrink-0 ml-3 ${conv.unreadCount > 0 ? "text-indigo-600 font-semibold" : "text-neutral-400"}`}>{lastMsgTime ? formatRelativeTime(lastMsgTime) : ""}</Text>
        </View>
        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
          <Text className={`text-[13px] flex-1 truncate ${conv.unreadCount > 0 ? "text-neutral-700 font-medium" : "text-neutral-400"}`} numberOfLines={1}>{lastMsgText}</Text>
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
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId: currentUserId, userRole: role } = useAuth();
  const { contractorProfile } = useContractor();
  const myContractorId = contractorProfile?._id || contractorProfile?.id;

  const recipientId = route.params?.recipientId;
  const recipientName = route.params?.recipientName;

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
  
  const messagesRef = useRef();
  const selectedConvRef = useRef();
  selectedConvRef.current = selectedConversation;
  const typingTimeoutRef = useRef(null);
  const lastTypingEmit = useRef(0);

  // ─── isMe detection (simple direct comparison) ──────────────────────────────
  const myIds = useMemo(() => {
    const ids = new Set();
    [currentUserId, myContractorId].forEach((id) => {
      const r = resolveId(id);
      if (r) ids.add(r);
    });
    return ids;
  }, [currentUserId, myContractorId]);

  const isMessageFromMe = useCallback(
    (msg) => {
      if (msg.__isLocalSent) return true;
      if (msg.type === "system") return false;

      // 1. ID-based matching (most precise)
      const senderIds = collectSenderIds(msg);
      if (senderIds.some((id) => myIds.has(id))) return true;

      // 2. Role-based fallback (for 1-on-1 chats between different roles)
      const myRole = role?.toLowerCase();
      const other = selectedConvRef.current?.otherParticipant;
      const otherRole = other?.role?.toLowerCase();
      const msgModel = (msg.senderOnModel || "").toLowerCase();

      if (msgModel === "contractor") {
        if (myRole === "contractor" && otherRole !== "contractor") return true;
        if (otherRole === "contractor" && myRole !== "contractor") return false;
      } else if (msgModel === "user" || msgModel === "client") {
        if ((myRole === "user" || myRole === "client") && (otherRole !== "user" && otherRole !== "client")) return true;
        if ((otherRole === "user" || otherRole === "client") && (myRole !== "user" && myRole !== "client")) return false;
      }

      return false;
    },
    [myIds, role]
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
        if (!isMessageFromMe(msg)) emitMessageRead(msg._id, currentUserId, selectedConvRef.current?.conversationId);
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
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [currentUserId, recipientId, recipientName, myContractorId]);

  useEffect(() => { if (currentUserId) loadConversations(); }, [currentUserId]);

  // ─── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (conversationId) => {
    setLoading(true);
    try {
      const data = await fetchMessages(conversationId);
      const msgs = Array.isArray(data) ? data : data?.messages || [];
      setMessages([...msgs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch {} finally { setLoading(false); }
  }, [currentUserId]);

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
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const handleTextChange = useCallback((text) => {
    setNewMessage(text);
    const cId = selectedConversation?.conversationId;
    if (cId && !cId.startsWith("temp-")) {
      const now = Date.now();
      if (now - lastTypingEmit.current > 2000) { emitTyping({ conversationId: cId, userId: currentUserId }); lastTypingEmit.current = now; }
    }
  }, [selectedConversation, currentUserId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (!result.canceled) setPendingAttachment(result.assets[0]);
  };

  const handleReport = async (category, details) => Alert.alert("Report Submitted", "Thank you. We'll review your report and take appropriate action.");

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

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <View className="flex-1" style={{ paddingTop: insets.top }}>
        
        {!showChat ? (
          <View className="flex-1">
            <View className="px-5 pt-3 pb-1"><Text className="text-[28px] font-bold text-neutral-900 tracking-tight">Messages</Text></View>
            <View className="px-5 pb-2 pt-1">
              <View className="bg-neutral-100 rounded-2xl px-4 py-3 flex-row items-center">
                <FontAwesome5 name="search" size={13} color="#a3a3a3" />
                <TextInput className="flex-1 ml-3 text-[14px] text-neutral-800" placeholder="Search conversations..." placeholderTextColor="#a3a3a3" value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery ? <Pressable onPress={() => setSearchQuery("")}><FontAwesome5 name="times-circle" size={14} color="#a3a3a3" /></Pressable> : null}
              </View>
            </View>
            {loading && filteredConversations.length === 0 ? (
              <View className="pt-4">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</View>
            ) : filteredConversations.length === 0 ? (
              <EmptyInbox />
            ) : (
              <FlatList data={filteredConversations} keyExtractor={(c) => c.conversationId || c._id} renderItem={({ item }) => <ConversationItem conv={item} currentUserId={currentUserId} onlineUsers={onlineUsers} onPress={() => setSelectedConversation(item)} />} ItemSeparatorComponent={() => <View className="ml-[82px] border-b border-neutral-100" />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadConversations(true)} tintColor="#818CF8" />} contentContainerStyle={{ paddingBottom: 20 }} />
            )}
          </View>
        ) : (
          <View className="flex-1">
            <View className="px-4 py-3 flex-row items-center bg-white border-b border-neutral-100/80" style={{ gap: 12 }}>
              <Pressable onPress={() => { if (route.name === "ChatScreen") navigation.goBack(); else setSelectedConversation(null); }} className="w-9 h-9 items-center justify-center rounded-full -ml-1">
                <FontAwesome5 name="chevron-left" size={16} color="#171717" />
              </Pressable>
              <View className="relative">
                {isSvgUrl(chatAvatar) ? <View className="w-10 h-10 rounded-full overflow-hidden"><SvgImage uri={chatAvatar} width="100%" height="100%" /></View> : <Image source={{ uri: chatAvatar }} className="w-10 h-10 rounded-full bg-neutral-100" />}
                {chatOnline && <View className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Text className="text-[15px] font-bold text-neutral-900 truncate" numberOfLines={1}>{chatName}</Text>
                  {chatOther?.role === "contractor" && (chatOther?.isVerified || chatOther?.isTopRated) && <VerifiedBadge size={14} animate={false} />}
                </View>
                <Text className="text-[11px] text-neutral-400 font-medium">{chatOnline ? "Online now" : "Offline"}</Text>
              </View>
              <Pressable onPress={() => setActionSheetVisible(true)} className="w-9 h-9 items-center justify-center rounded-full"><FontAwesome5 name="ellipsis-h" size={16} color="#525252" /></Pressable>
            </View>

            <ScrollView ref={messagesRef} className="flex-1 bg-neutral-50/60" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }} onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: false })} onScroll={(e) => { const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent; setShowScrollBtn(contentSize.height - layoutMeasurement.height - contentOffset.y > 300); }} scrollEventThrottle={64}>
              {loading ? (
                <View className="items-center py-10"><ActivityIndicator size="small" color="#818CF8" /></View>
              ) : (
                processedMessages.map((msg, idx) => {
                  if (msg.type === "system" || resolveId(msg.senderId || msg.sender) === "system") return <View key={msg._id || `s-${idx}`} className="items-center my-4"><View className="bg-neutral-200/60 px-4 py-1.5 rounded-full"><Text className="text-[11px] text-neutral-500 font-medium">{msg.messageText}</Text></View></View>;
                  const isMe = msg.isMe;
                  return (
                    <View key={msg._id || `m-${idx}`}>
                      {msg.showDate && <View className="items-center my-5"><View className="bg-white/80 px-4 py-1.5 rounded-full shadow-sm border border-neutral-100/50"><Text className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{formatChatDate(msg.createdAt)}</Text></View></View>}
                      <View className={`flex-row ${isMe ? "justify-end" : "justify-start"} ${msg.isFirstInGroup ? "mt-4" : "mt-1"}`}>
                        {!isMe && msg.isFirstInGroup ? <View className="w-8 mr-2 mt-1 items-center">{isSvgUrl(chatAvatar) ? <View className="w-7 h-7 rounded-full overflow-hidden"><SvgImage uri={chatAvatar} width="100%" height="100%" /></View> : <Image source={{ uri: chatAvatar }} className="w-7 h-7 rounded-full bg-neutral-100" />}</View> : !isMe ? <View className="w-8 mr-2" /> : null}
                        <View className={`max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
                          <View className={`px-[14px] py-[10px] ${isMe ? `bg-indigo-600 ${msg.isFirstInGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl"}` : `bg-white ${msg.isFirstInGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl"}`}`} style={!isMe ? { shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { height: 1 }, elevation: 1 } : undefined}>
                            {msg.type === "quote" && msg.quote && <View className={`rounded-xl p-3 mb-2 border ${isMe ? "bg-indigo-500 border-indigo-400" : "bg-neutral-50 border-neutral-200"}`}><Text className={`text-[9px] font-black tracking-[0.15em] uppercase mb-1 ${isMe ? "text-indigo-200" : "text-indigo-600"}`}>Project Quote</Text><Text className={`text-[13px] font-bold ${isMe ? "text-white" : "text-neutral-900"}`}>{msg.quote.projectName}</Text><Text className={`text-[17px] font-black mt-1 ${isMe ? "text-white" : "text-neutral-900"}`}>${(msg.quote.total || 0).toLocaleString()}</Text><Pressable className={`mt-3 py-2 rounded-lg items-center ${isMe ? "bg-white/20" : "bg-indigo-600"}`}><Text className="text-[11px] font-bold text-white">Review Details</Text></Pressable></View>}
                            {msg.attachmentUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachmentUrl) && <Pressable onPress={() => { setActiveImage(msg.attachmentUrl); setLightboxVisible(true); }} className="mb-1.5 -mx-[2px] -mt-[2px] overflow-hidden" style={{ borderRadius: msg.isFirstInGroup ? 14 : 16 }}><Image source={{ uri: msg.attachmentUrl }} style={{ width: 240, height: 180 }} resizeMode="cover" /></Pressable>}
                            {msg.attachmentUrl && !/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachmentUrl) && <Pressable className={`flex-row items-center p-2.5 rounded-xl mb-1.5 border ${isMe ? "bg-white/10 border-white/20" : "bg-neutral-50 border-neutral-200"}`}><FontAwesome5 name="file-alt" size={14} color={isMe ? "white" : "#737373"} /><Text className={`text-[12px] ml-2 font-semibold ${isMe ? "text-white" : "text-neutral-600"}`}>View Attachment</Text></Pressable>}
                            {msg.messageText ? <Text className={`text-[15px] leading-[22px] ${isMe ? "text-white" : "text-neutral-800"}`}>{msg.messageText}</Text> : null}
                          </View>
                          {msg.isLastInGroup && <View className={`flex-row items-center mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`} style={{ gap: 4 }}><Text className="text-[10px] text-neutral-400 font-medium">{msg.timeStr}</Text>{isMe && <FontAwesome5 name={msg.read ? "check-double" : "check"} size={9} color={msg.read ? "#10b981" : "#c4b5fd"} solid={msg.read} />}</View>}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
              {isOtherTyping && <TypingIndicator name={chatName?.split(" ")[0]} />}
            </ScrollView>

            {showScrollBtn && <Pressable onPress={() => messagesRef.current?.scrollToEnd({ animated: true })} className="absolute bottom-24 right-4 w-9 h-9 bg-white rounded-full items-center justify-center shadow-lg" style={{ shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 5 }}><FontAwesome5 name="chevron-down" size={12} color="#525252" /></Pressable>}

            {pendingAttachment && <View className="px-4 py-2.5 bg-white border-t border-neutral-100 flex-row items-center justify-between"><View className="flex-row items-center" style={{ gap: 10 }}><Image source={{ uri: pendingAttachment.uri }} className="w-12 h-12 rounded-xl" /><View><Text className="text-[12px] font-semibold text-neutral-700">Image ready to send</Text><Text className="text-[10px] text-neutral-400">Tap send to share</Text></View></View><Pressable onPress={() => setPendingAttachment(null)} className="w-7 h-7 bg-neutral-100 rounded-full items-center justify-center"><FontAwesome5 name="times" size={10} color="#525252" /></Pressable></View>}

            <View className="px-4 py-3 bg-white border-t border-neutral-100 flex-row items-end" style={{ gap: 8, paddingBottom: insets.bottom + 12 || 12 }}>
              <Pressable onPress={pickImage} className="w-9 h-9 items-center justify-center rounded-full bg-neutral-50"><FontAwesome5 name="image" size={15} color="#737373" /></Pressable>
              <Pressable onPress={() => Alert.alert("Coming Soon", "File attachments are coming soon.")} className="w-9 h-9 items-center justify-center rounded-full bg-neutral-50"><FontAwesome5 name="paperclip" size={15} color="#737373" /></Pressable>
              <View className="flex-1 bg-neutral-100 rounded-2xl px-4 py-2.5 max-h-[120px]"><TextInput className="text-[15px] text-neutral-800 leading-5" placeholder="Type a message..." placeholderTextColor="#a3a3a3" value={newMessage} onChangeText={handleTextChange} multiline style={{ maxHeight: 100 }} /></View>
              <Pressable onPress={handleSendMessage} disabled={(!newMessage.trim() && !pendingAttachment) || isUploading} className={`w-10 h-10 rounded-full items-center justify-center mb-0.5 ${newMessage.trim() || pendingAttachment ? "bg-indigo-600" : "bg-neutral-200"}`} style={newMessage.trim() || pendingAttachment ? { shadowColor: "#4F46E5", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { height: 2 }, elevation: 3 } : undefined}>
                {isUploading ? <ActivityIndicator size="small" color="white" /> : <FontAwesome5 name="paper-plane" size={14} color={newMessage.trim() || pendingAttachment ? "white" : "#a3a3a3"} />}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <ImageLightbox images={activeImage ? [activeImage] : []} visible={lightboxVisible} onClose={() => setLightboxVisible(false)} />
      
      <ActionSheet visible={actionSheetVisible} onClose={() => setActionSheetVisible(false)} title="Chat Options" options={[{ id: "viewProfile", label: "View Profile", icon: "user", onPress: () => {} }, { id: "report", label: "Report User", icon: "flag", isDestructive: true, onPress: () => { setActionSheetVisible(false); setTimeout(() => setReportModalVisible(true), 300); } }, { id: "block", label: "Block User", icon: "ban", isDestructive: true, onPress: () => Alert.alert("Block User", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: () => {} }]) }]} />
      
      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} userName={chatName} onReport={handleReport} />
    </KeyboardAvoidingView>
  );
};

export default MessagesScreen;