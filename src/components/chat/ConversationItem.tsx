import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { VerifiedBadge } from '../common/VerifiedBadge';
import { SvgImage } from '../common/SvgImage';
import { getProfileImageUrl, isSvgUrl } from '../../utils/avatarUtils';

const defaultFormatRelativeTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

const defaultGetDisplayName = (entity: any) => {
  if (!entity) return 'Unknown';
  if (entity.companyName || entity.businessName) return entity.companyName || entity.businessName;
  const firstLast = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
  if (firstLast) return firstLast;
  if (entity.name) return entity.name;
  if (entity.email) return entity.email.split('@')[0];
  return 'User';
};

interface ConversationItemProps {
  conv: any;
  currentUserId?: string | null;
  onlineUsers?: Record<string, boolean>;
  onPress: (conv: any) => void;
  formatRelativeTime?: (dateStr: string) => string;
  getParticipantDisplayName?: (entity: any) => string;
}

export const ConversationItem = React.memo(function ConversationItem({
  conv,
  currentUserId,
  onlineUsers = {},
  onPress,
  formatRelativeTime = defaultFormatRelativeTime,
  getParticipantDisplayName = defaultGetDisplayName,
}: ConversationItemProps) {
  const other = conv.otherParticipant;
  const displayName = getParticipantDisplayName(other) || 'Unknown';
  const avatarUrl = getProfileImageUrl(displayName, other?.profilePicture || '', other?.category);
  const isOnline = onlineUsers[other?._id] || false;
  const hasAttachment = conv.lastMessage?.attachmentUrl;
  const isImage = hasAttachment && /\.(jpg|jpeg|png|gif|webp)$/i.test(conv.lastMessage.attachmentUrl);
  const lastMsgText =
    conv.lastMessage?.messageText || (hasAttachment ? (isImage ? '📷 Photo' : '📎 Attachment') : 'No messages yet');
  const lastMsgTime = conv.lastMessage?.createdAt || '';

  return (
    <Pressable
      onPress={() => onPress(conv)}
      className="flex-row items-center px-5 py-3.5 active:bg-neutral-50 dark:active:bg-neutral-800"
      style={{ gap: 14 }}
    >
      <View className="relative shrink-0">
        {isSvgUrl(avatarUrl) ? (
          <View className="w-[54px] h-[54px] rounded-full overflow-hidden">
            <SvgImage uri={avatarUrl} width="100%" height="100%" />
          </View>
        ) : (
          <Image source={{ uri: avatarUrl }} className="w-[54px] h-[54px] rounded-full bg-neutral-100 dark:bg-neutral-700" />
        )}
        {isOnline && (
          <View className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-[2.5px] border-white dark:border-neutral-900" />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1" style={{ gap: 5 }}>
            <Text
              className={`text-[15px] truncate ${
                conv.unreadCount > 0 ? 'font-bold text-neutral-900 dark:text-white' : 'font-semibold text-neutral-800 dark:text-neutral-300'
              }`}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {other?.role === 'contractor' && (other?.isVerified || other?.isTopRated) && (
              <VerifiedBadge size={13} animate={false} />
            )}
          </View>
          <Text
            className={`text-[11px] shrink-0 ml-3 ${
              conv.unreadCount > 0 ? 'text-indigo-600 font-semibold' : 'text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {lastMsgTime ? formatRelativeTime(lastMsgTime) : ''}
          </Text>
        </View>
        <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
          <Text
            className={`text-[13px] flex-1 truncate ${
              conv.unreadCount > 0 ? 'text-neutral-700 dark:text-neutral-300 font-medium' : 'text-neutral-400 dark:text-neutral-500'
            }`}
            numberOfLines={1}
          >
            {lastMsgText}
          </Text>
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

export default ConversationItem;
