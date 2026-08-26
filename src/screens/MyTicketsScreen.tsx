import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  Alert,
  RefreshControl,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { getMyHelpTickets, userReplyHelpTicket, userResolveHelpTicket } from '../api';
import { useAuth } from '../context/AuthContext';
import HapticFeedback from '../utils/haptics';
import { BouncingDotsLoader } from '../components/common';

export default function MyTicketsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const targetTicketId = (route.params || {})?.ticketId;

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await getMyHelpTickets();
      if (res?.tickets) {
        setTickets(res.tickets);
        if (targetTicketId) {
          const match = res.tickets.find(
            (t: any) => t.ticketId === targetTicketId || t._id === targetTicketId
          );
          if (match) {
            setExpandedTicketId(match._id);
          } else if (res.tickets.length > 0 && !expandedTicketId) {
            setExpandedTicketId(res.tickets[0]._id);
          }
        } else if (res.tickets.length > 0 && !expandedTicketId) {
          setExpandedTicketId(res.tickets[0]._id);
        }
      }
    } catch (err: any) {
      // Handle silently on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expandedTicketId, targetTicketId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleSendReply = async (ticketId: string) => {
    if (!replyMessage.trim()) return;
    try {
      setSendingReply(true);
      HapticFeedback.light();
      await userReplyHelpTicket(ticketId, replyMessage.trim());
      HapticFeedback.success();
      setReplyMessage('');
      fetchTickets();
      Alert.alert('Follow-Up Sent', 'Your reply has been sent to our support specialists.');
    } catch (err: any) {
      HapticFeedback.error();
      Alert.alert('Notice', err?.message || 'Failed to send follow-up.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    try {
      HapticFeedback.light();
      await userResolveHelpTicket(ticketId);
      HapticFeedback.success();
      fetchTickets();
      Alert.alert('Ticket Resolved', 'Your support ticket has been marked as resolved.');
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Failed to resolve ticket.');
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'active') return t.status !== 'resolved' && t.status !== 'closed';
    if (filter === 'resolved') return t.status === 'resolved' || t.status === 'closed';
    return true;
  });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#0a0a0a' : '#fafafa',
        paddingTop: Math.max(insets.top, 12),
      }}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View className="px-5 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200/80 dark:border-neutral-800 flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            HapticFeedback.light();
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', { screen: 'Explore' });
            }
          }}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center"
        >
          <FontAwesome5 name="arrow-left" size={14} color={isDark ? '#e5e5e5' : '#171717'} />
        </Pressable>

        <Text className="text-base font-bold text-neutral-900 dark:text-white">
          Support Case Tracker
        </Text>

        <Pressable
          onPress={() => {
            HapticFeedback.light();
            navigation.navigate('ContactSupport');
          }}
          className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800"
        >
          <Text className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            + New Ticket
          </Text>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View className="px-5 pt-4 pb-2 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
        <View className="flex-row p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
          <Pressable
            onPress={() => {
              HapticFeedback.selection();
              setFilter('all');
            }}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${
              filter === 'all' ? 'bg-white dark:bg-neutral-700 shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                filter === 'all'
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              All ({tickets.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              HapticFeedback.selection();
              setFilter('active');
            }}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${
              filter === 'active' ? 'bg-white dark:bg-neutral-700 shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                filter === 'active'
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              In Progress ({tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              HapticFeedback.selection();
              setFilter('resolved');
            }}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${
              filter === 'resolved' ? 'bg-white dark:bg-neutral-700 shadow-xs' : ''
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                filter === 'resolved'
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              Resolved ({tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length})
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        className="flex-1"
      >
        {loading ? (
          <View className="py-20 items-center justify-center">
            <BouncingDotsLoader size="medium" color="#6366f1" />
          </View>
        ) : filteredTickets.length === 0 ? (
          <View className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-center items-center">
            <View className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 items-center justify-center mb-3">
              <FontAwesome5 name="headset" size={20} color="#6366f1" />
            </View>
            <Text className="text-base font-bold text-neutral-900 dark:text-white mb-1">
              No Support Tickets
            </Text>
            <Text className="text-xs text-neutral-500 text-center mb-5 leading-relaxed">
              You have no active support requests. If you have questions regarding escrow or milestones, reach out anytime.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('ContactSupport')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 active:bg-indigo-700"
            >
              <Text className="text-xs font-bold text-white">Contact Support Specialists</Text>
            </Pressable>
          </View>
        ) : (
          <View className="space-y-4">
            {filteredTickets.map((ticket) => {
              const isExpanded = expandedTicketId === ticket._id;
              const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

              return (
                <View
                  key={ticket._id}
                  className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 overflow-hidden shadow-xs"
                >
                  {/* Ticket Summary Header */}
                  <Pressable
                    onPress={() => {
                      HapticFeedback.selection();
                      setExpandedTicketId(isExpanded ? null : ticket._id);
                    }}
                    className="p-4 active:bg-neutral-50 dark:active:bg-neutral-800/60"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        <Text className="font-mono text-xs font-bold text-neutral-500">
                          #{ticket.ticketId || 'TIK'}
                        </Text>
                        <Text className="text-[10px] uppercase font-bold text-neutral-400 capitalize">
                          &middot; {ticket.topic}
                        </Text>
                      </View>

                      <View
                        className={`px-2.5 py-0.5 rounded-full ${
                          isResolved
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
                            : ticket.status === 'in_progress'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-black uppercase ${
                            isResolved
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : ticket.status === 'in_progress'
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {ticket.status === 'in_progress' ? 'In Progress' : ticket.status}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                      {ticket.subject}
                    </Text>

                    <Text className="text-xs text-neutral-500 line-clamp-2">
                      {ticket.message}
                    </Text>

                    <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <Text className="text-[10px] text-neutral-400">
                        Submitted {new Date(ticket.createdAt).toLocaleDateString()}
                      </Text>
                      <FontAwesome5
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={10}
                        color="#9ca3af"
                      />
                    </View>
                  </Pressable>

                  {/* Expanded Thread & Actions */}
                  {isExpanded && (
                    <View className="p-4 bg-neutral-50/70 dark:bg-neutral-800/40 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
                      {/* Timeline Stepper */}
                      <View className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                        <Text className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                          Case Progress
                        </Text>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-1.5">
                            <View className="w-4 h-4 rounded-full bg-emerald-500 items-center justify-center">
                              <FontAwesome5 name="check" size={8} color="#ffffff" />
                            </View>
                            <Text className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                              Received
                            </Text>
                          </View>

                          <View className="flex-1 h-0.5 bg-neutral-200 dark:bg-neutral-700 mx-2" />

                          <View className="flex-row items-center gap-1.5">
                            <View
                              className={`w-4 h-4 rounded-full items-center justify-center ${
                                ticket.status !== 'new' ? 'bg-emerald-500' : 'bg-neutral-300'
                              }`}
                            >
                              <FontAwesome5
                                name={ticket.status !== 'new' ? 'check' : 'circle'}
                                size={8}
                                color="#ffffff"
                              />
                            </View>
                            <Text className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                              In Review
                            </Text>
                          </View>

                          <View className="flex-1 h-0.5 bg-neutral-200 dark:bg-neutral-700 mx-2" />

                          <View className="flex-row items-center gap-1.5">
                            <View
                              className={`w-4 h-4 rounded-full items-center justify-center ${
                                isResolved ? 'bg-emerald-500' : 'bg-neutral-300'
                              }`}
                            >
                              <FontAwesome5
                                name={isResolved ? 'check' : 'circle'}
                                size={8}
                                color="#ffffff"
                              />
                            </View>
                            <Text className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                              Resolved
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Conversation History & Airbnb Style Thread */}
                      <View className="space-y-2.5">
                        <Text className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Conversation History ({1 + (ticket.replies?.length || 0)} messages)
                        </Text>

                        {/* Message 1: Initial Customer Submission */}
                        <View className="p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
                          <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
                              {ticket.name} (Your Inquiry)
                            </Text>
                            <Text className="text-[9px] text-neutral-400">
                              {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                          <Text className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
                            {ticket.message}
                          </Text>
                        </View>

                        {/* Messages 2+: Back-and-forth Replies */}
                        {ticket.replies && ticket.replies.map((reply: any, i: number) => {
                          const isAgent = reply.authorType === 'agent';

                          return (
                            <View
                              key={i}
                              className={`p-3.5 rounded-2xl border ${
                                isAgent
                                  ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-900/60'
                                  : 'bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800'
                              }`}
                            >
                              <View className="flex-row justify-between items-center mb-1.5">
                                <Text
                                  className={`text-[10px] font-bold ${
                                    isAgent
                                      ? 'text-indigo-600 dark:text-indigo-400'
                                      : 'text-neutral-700 dark:text-neutral-300'
                                  }`}
                                >
                                  {isAgent ? `🛡️ ${reply.authorName || 'Ratedeed Support Specialist'}` : `${reply.authorName || ticket.name} (You)`}
                                </Text>
                                <Text className="text-[9px] text-neutral-400">
                                  {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                </Text>
                              </View>
                              <Text className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed">
                                {reply.body}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Reply Composer */}
                      {!isResolved && (
                        <View className="pt-2 space-y-2">
                          <TextInput
                            value={replyMessage}
                            onChangeText={setReplyMessage}
                            placeholder="Add follow-up details for our team..."
                            placeholderTextColor="#9ca3af"
                            multiline
                            numberOfLines={3}
                            className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
                          />

                          <View className="flex-row items-center justify-between gap-2">
                            <Pressable
                              onPress={() => handleResolve(ticket._id)}
                              className="px-3.5 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-700"
                            >
                              <Text className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
                                Mark Resolved
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => handleSendReply(ticket._id)}
                              disabled={sendingReply || !replyMessage.trim()}
                              className="px-5 py-2 rounded-xl bg-indigo-600 disabled:opacity-40"
                            >
                              {sendingReply ? (
                                <BouncingDotsLoader size="small" color="#ffffff" />
                              ) : (
                                <Text className="text-[11px] font-bold text-white">
                                  Send Reply
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
