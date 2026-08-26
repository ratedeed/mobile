import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  SectionList,
  Pressable,
  Text,
  Alert,
  StyleSheet,
  useColorScheme,
  Image,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { SvgImage } from '../components/common/SvgImage';
import { BouncingRefreshSectionList } from '../components/common';
import { getProfileImageUrl, isSvgUrl, isRealImageUrl } from '../utils/avatarUtils';
import { Colors, Shadows, Spacing, Radii, FontSizes, FontWeights } from '../constants/designTokens';

type NotificationItem = {
  _id: string;
  message: string;
  link?: string;
  read: boolean;
  type?: string;
  createdAt?: string;
  [key: string]: any;
};

type NotificationSection = {
  title: string;
  data: NotificationItem[];
};

const createStyles = (isDark: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: isDark ? '#09090B' : Colors.neutral50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: isDark ? '#09090B' : '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? '#27272a' : Colors.neutral200,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold as any,
    color: isDark ? '#ffffff' : Colors.neutral900,
  },
  headerSubtitle: {
    fontSize: FontSizes.xs,
    color: isDark ? '#a3a3a3' : Colors.neutral500,
    fontWeight: FontWeights.medium as any,
    marginTop: 2,
  },
  markAllHeaderBtn: {
    backgroundColor: isDark ? '#1e1b4b' : Colors.primary50,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.round,
  },
  markAllHeaderText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold as any,
    color: isDark ? '#818cf8' : Colors.primary600,
  },
  skeletonList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: isDark ? '#09090B' : Colors.neutral50,
  },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold as any,
    color: isDark ? '#a3a3a3' : Colors.neutral500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  markAllBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  markAllText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold as any,
    color: isDark ? '#818cf8' : Colors.primary600,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? '#171717' : '#fff',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radii.md,
    ...Shadows.xs,
  },
  cardUnread: {
    backgroundColor: isDark ? '#1e1b4b' : Colors.primary50,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary500,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 2,
    marginTop: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: Spacing.sm + 2,
    marginTop: 1,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  cardBody: {
    flex: 1,
  },
  cardMessage: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    color: isDark ? '#d4d4d4' : Colors.neutral700,
    fontWeight: FontWeights.medium as any,
  },
  cardMessageUnread: {
    color: isDark ? '#ffffff' : Colors.neutral900,
    fontWeight: FontWeights.bold as any,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  cardTime: {
    fontSize: FontSizes.xs,
    color: isDark ? '#6b7280' : Colors.neutral400,
    fontWeight: FontWeights.medium as any,
  },
  toggleReadBtn: {
    padding: Spacing.xxs + 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary500,
    marginTop: 6,
    marginLeft: Spacing.xs,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
});

const NotificationsScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const styles = createStyles(isDark);
  const navigation = useNavigation<any>();
  const {
    notifications,
    unreadCount,
    isLoading,
    refreshNotifications,
    toggleRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const { userRole } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      refreshNotifications().finally(() => {
        if (isMounted) setIsInitialLoad(false);
      });
      return () => { isMounted = false; };
    }, [refreshNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, [refreshNotifications]);

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.read) {
      await toggleRead(item._id);
    }

    const t = (item.type || '').toLowerCase();
    const m = (item.message || '').toLowerCase();
    const rawLink = item.link || '';

    // 1. Direct Support Ticket Deep-linking (opens MyTickets screen with thread)
    if (
      t === 'ticket_reply' ||
      t.includes('ticket') ||
      m.includes('ticket') ||
      m.includes('ratedeed support') ||
      rawLink.includes('/help') ||
      rawLink.includes('/my-tickets')
    ) {
      const ticketIdMatch = m.match(/#?(TIK-[A-Z0-9]+)/i);
      navigation.navigate('MyTickets', {
        ticketId: ticketIdMatch ? ticketIdMatch[1] : undefined,
      });
      return;
    }

    // Direct Parameter Deep-linking
    const convId = item.conversationId || item.conversation || item.chatId || (item.data && (item.data.conversationId || item.data.conversation));
    const jobIdParam = item.jobId || item.job || (item.data && (item.data.jobId || item.data.job));
    const quoteIdParam = item.quoteId || item.quote || (item.data && (item.data.quoteId || item.data.quote));

    if (convId) {
      navigation.navigate('ChatScreen', { conversationId: convId.toString() });
      return;
    }
    if (jobIdParam) {
      navigation.navigate('JobDetail', { jobId: jobIdParam.toString() });
      return;
    }
    if (quoteIdParam) {
      navigation.navigate('QuoteReview', { quoteId: quoteIdParam.toString() });
      return;
    }

    if (!item.link) {
      // Fallback for notifications without explicit link string
      if (t === 'admin_message' || t === 'new_message' || t === 'message' || m.includes('message')) {
        navigation.navigate('Messages');
      } else if (t.includes('affiliate') || t.includes('commission') || t.includes('payout') || m.includes('commission') || m.includes('payout')) {
        navigation.navigate('AffiliateScreen');
      } else if (t.includes('job') || t.includes('milestone') || t.includes('payment') || m.includes('payment') || m.includes('milestone')) {
        navigation.navigate('Jobs');
      }
      return;
    }

    let path = item.link;
    if (path.startsWith('http')) {
      try {
        const urlObj = new URL(path);
        path = urlObj.pathname + urlObj.search;
      } catch (e) {
        path = path.replace(/^https?:\/\/[^\/]+/, '');
      }
    }

    if (path.startsWith('/messages/')) {
      const conversationId = path.split('/')[2];
      navigation.navigate('ChatScreen', { conversationId });
    } else if (path.startsWith('/messages')) {
      navigation.navigate('Messages');
    } else if (path.startsWith('/leads/')) {
      if (userRole === 'contractor' || userRole === 'admin') {
        navigation.navigate('ContractorDashboard');
      } else {
        navigation.navigate('Profile');
      }
    } else if (path.startsWith('/quotes/')) {
      navigation.navigate('Jobs');
    } else if (path.startsWith('/jobs/')) {
      const jobId = path.split('/')[2];
      if (jobId) {
        navigation.navigate('JobDetail', { jobId });
      } else {
        navigation.navigate('Jobs');
      }
    } else if (path.startsWith('/jobs')) {
      navigation.navigate('Jobs');
    } else if (path.startsWith('/quote-review')) {
      const quoteId = path.match(/[?&]quoteId=([^&]+)/)?.[1];
      if (quoteId) {
        navigation.navigate('QuoteReview', { quoteId });
      }
    } else if (path.startsWith('/contractor-dashboard')) {
      if (userRole === 'contractor' || userRole === 'admin') {
        const isPaymentsTab = path.includes('tab=payments');
        navigation.navigate('ContractorDashboard', isPaymentsTab ? { initialTab: 'payments' } : undefined);
      } else {
        navigation.navigate('Profile');
      }
    } else if (path.startsWith('/detail/')) {
      const slug = path.split('/')[2];
      if (slug) {
        navigation.navigate('BusinessDetail', { slug });
      }
    } else if (path.startsWith('/post/')) {
      if (userRole === 'contractor' || userRole === 'admin') {
        navigation.navigate('ContractorDashboard', { initialTab: 'profile' });
      } else {
        navigation.navigate('Home');
      }
    } else if (path.startsWith('/payment/')) {
      const quoteId = path.split('/')[2];
      if (quoteId) {
        (async () => {
          try {
            const { getQuote } = await import('../api');
            const q = await getQuote(quoteId);
            if (q) {
              const firstMilestone = (q.isMilestone && q.milestones?.length)
                ? q.milestones.find((m: any) => m.status === 'pending' || !m.status) || q.milestones[0]
                : null;
              navigation.navigate('PaymentFlow', {
                quoteId: q._id,
                milestoneId: firstMilestone ? (firstMilestone._id || firstMilestone.id) : undefined,
                totalAmount: firstMilestone ? firstMilestone.amount : (q.totalAmount || q.quoteTotal || 0),
                contractorName: q.contractorId?.companyName || q.contractorId?.businessName || 'Contractor',
                description: q.description || q.projectTitle || 'Home Project',
                isMilestone: q.isMilestone,
              });
            } else {
              navigation.navigate('PaymentFlow', { quoteId });
            }
          } catch {
            navigation.navigate('PaymentFlow', { quoteId });
          }
        })();
      }
    } else if (path.startsWith('/dispute/')) {
      const jobId = path.split('/')[2];
      if (jobId) {
        navigation.navigate('DisputeScreen', { jobId });
      }
    } else if (path.startsWith('/review/')) {
      const jobId = path.split('/')[2];
      if (jobId) {
        (async () => {
          try {
            const { getJobById } = await import('../api');
            const j = await getJobById(jobId);
            if (j) {
              const contractor = j.contractor || {};
              const quote = j.quote || {};
              navigation.navigate('ReviewScreen', {
                jobId: j._id,
                quoteId: quote._id || j._id,
                contractorId: contractor._id || contractor.id || j.contractorId,
                contractorName: contractor.companyName || contractor.businessName || 'Contractor',
              });
            } else {
              navigation.navigate('ReviewScreen', { jobId });
            }
          } catch {
            navigation.navigate('ReviewScreen', { jobId });
          }
        })();
      }
    } else if (path.startsWith('/affiliate')) {
      navigation.navigate('AffiliateScreen');
    }
  };

  const getDateGroup = (dateStr?: string): string => {
    if (!dateStr) return 'Earlier';
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const notifDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (notifDate.getTime() === today.getTime()) return 'Today';
    if (notifDate.getTime() === yesterday.getTime()) return 'Yesterday';
    return 'Earlier';
  };

  const groupedNotifications: NotificationSection[] = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {};
    const order = ['Today', 'Yesterday', 'Earlier'];
    for (const notif of notifications) {
      const group = getDateGroup(notif.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(notif);
    }
    return order
      .filter(title => groups[title]?.length > 0)
      .map(title => ({ title, data: groups[title] }));
  }, [notifications]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type?: string, message?: string) => {
    const m = (message || '').toLowerCase();
    if (type === 'ticket_reply' || m.includes('ticket') || m.includes('ratedeed support')) return { name: 'headset', color: '#6366f1', bg: isDark ? '#1e1b4b' : '#eef2ff' };
    if (type === 'new_review' || m.includes('review')) return { name: 'star', color: '#f59e0b', bg: isDark ? '#451a03' : '#fef3c7' };
    if (type === 'new_message' || m.includes('message')) return { name: 'comment', color: '#3b82f6', bg: isDark ? '#1e3a8a' : '#dbeafe' };
    if (m.includes('quote') || m.includes('payment') || type === 'job_funded') return { name: 'dollar-sign', color: '#10b981', bg: isDark ? '#064e3b' : '#d1fae5' };
    if (type === 'new_lead' || m.includes('lead') || m.includes('project')) return { name: 'briefcase', color: '#8b5cf6', bg: isDark ? '#3b0764' : '#ede9fe' };
    if (type === 'job_update') return { name: 'wrench', color: '#f97316', bg: isDark ? '#431407' : '#ffedd5' };
    if (type === 'admin_alert' || type === 'system_update') return { name: 'info-circle', color: '#6366f1', bg: isDark ? '#1e1b4b' : '#eef2ff' };
    if (type === 'license_approved') return { name: 'shield-alt', color: '#10b981', bg: isDark ? '#064e3b' : '#d1fae5' };
    if (type === 'license_rejected') return { name: 'exclamation-triangle', color: '#DC2626', bg: isDark ? '#450a0a' : '#fee2e2' };
    return { name: 'bell', color: '#4F46E5', bg: isDark ? '#1e1b4b' : '#eef2ff' };
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const icon = getNotificationIcon(item.type, item.message);
    const hasSenderAvatar = !!(item.sender && item.sender.profilePicture && isRealImageUrl(item.sender.profilePicture));
    const avatarUrl = hasSenderAvatar ? item.sender.profilePicture : '';

    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => {
          Alert.alert('Notification Actions', '', [
            {
              text: item.read ? 'Mark as unread' : 'Mark as read',
              onPress: () => toggleRead(item._id),
            },
            { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(item._id) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        style={[styles.card, !item.read && styles.cardUnread]}
      >
        {hasSenderAvatar ? (
          <View style={styles.avatarCircle}>
            {isSvgUrl(avatarUrl) ? (
              <SvgImage uri={avatarUrl} width={40} height={40} />
            ) : (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            )}
          </View>
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <FontAwesome5 name={icon.name as any} size={15} color={icon.color} />
          </View>
        )}

        <View style={styles.cardBody}>
          <Text
            style={[styles.cardMessage, !item.read && styles.cardMessageUnread]}
            numberOfLines={2}
          >
            {item.message}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTime}>{formatDate(item.createdAt)}</Text>
            <Pressable
              hitSlop={12}
              onPress={() => toggleRead(item._id)}
              style={styles.toggleReadBtn}
            >
              <FontAwesome5
                name={item.read ? 'envelope' : 'envelope-open'}
                size={11}
                color={isDark ? '#6b7280' : Colors.neutral400}
              />
            </Pressable>
          </View>
        </View>

        {!item.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: NotificationSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.title === 'Today' && unreadCount > 0 && (
        <Pressable onPress={markAllAsRead} style={styles.markAllBtn}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      )}
    </View>
  );

  if (isLoading && isInitialLoad && notifications.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <SkeletonLoader type="text" count={1} />
          </View>
        </View>
        <View style={styles.skeletonList}>
          <SkeletonLoader type="notification" count={6} />
        </View>
      </View>
    );
  }

  if (!isLoading && notifications.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>All caught up!</Text>
          </View>
        </View>
        <EmptyState
          title="No notifications yet"
          message="When you receive messages, leads, or updates, they'll appear here for quick access."
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={markAllAsRead} style={styles.markAllHeaderBtn}>
            <Text style={styles.markAllHeaderText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <BouncingRefreshSectionList
        sections={groupedNotifications}
        keyExtractor={(item, index) => item._id || `notif-${index}`}
        renderItem={renderNotification}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        loaderColor={Colors.primary500}
      />
    </View>
  );
};

export default NotificationsScreen;
