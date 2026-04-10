import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/common/Header';
import Button from '../components/common/Button';

// Mock types for now, replace with actual types later
type QuoteRequest = {
  id: string;
  contractorName: string;
  contractorImage: string;
  serviceType: string;
  quoteTotal: number;
  status: string;
  createdAt: string;
  hasReview?: boolean;
  reviewRating?: number;
};

type TabFilter = 'all' | 'active' | 'completed';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'submitted':
      return { label: 'Awaiting Quote', color: '#b45309', bgColor: '#fef3c7', dotColor: '#f59e0b' };
    case 'declined':
      return { label: 'Declined', color: '#6b7280', bgColor: '#f3f4f6', dotColor: '#9ca3af' };
    case 'quoted':
      return { label: 'Quote Ready', color: '#1d4ed8', bgColor: '#dbeafe', dotColor: '#3b82f6', action: { label: 'View Quote', page: 'QuoteReview' } };
    case 'payment_method':
    case 'payment_review':
    case 'payment_processing':
      return { label: 'Payment Pending', color: '#c2410c', bgColor: '#ffedd5', dotColor: '#f97316', action: { label: 'Resume', page: 'PaymentFlow' } };
    case 'payment_confirmed':
      return { label: 'Paid — In Escrow', color: '#047857', bgColor: '#d1fae5', dotColor: '#10b981', action: { label: 'Details', page: 'PaymentFlow' } };
    case 'in_progress':
      return { label: 'In Progress', color: '#7c3aed', bgColor: '#ede9fe', dotColor: '#8b5cf6' };
    case 'completed':
      return { label: 'Completed', color: '#4b5563', bgColor: '#f3f4f6', dotColor: '#6b7280' };
    case 'disputed':
      return { label: 'Disputed', color: '#be123c', bgColor: '#ffe4e6', dotColor: '#f43f5e' };
    case 'dispute_resolved':
      return { label: 'Dispute Resolved', color: '#047857', bgColor: '#d1fae5', dotColor: '#10b981' };
    default:
      return { label: 'Draft', color: '#6b7280', bgColor: '#f3f4f6', dotColor: '#9ca3af' };
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ActiveJobsScreen() {
  const navigation = useNavigation<any>();
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load mock data for now
    setTimeout(() => {
      setQuotes([
        {
          id: '1',
          contractorName: 'Acme Plumbing',
          contractorImage: 'https://via.placeholder.com/150',
          serviceType: 'Pipe Repair',
          quoteTotal: 450,
          status: 'payment_method',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          contractorName: 'Elite Electric',
          contractorImage: 'https://via.placeholder.com/150',
          serviceType: 'Wiring Update',
          quoteTotal: 1200,
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          hasReview: false,
        },
        {
          id: '3',
          contractorName: 'Top Tier Roofing',
          contractorImage: 'https://via.placeholder.com/150',
          serviceType: 'Roof Replacement',
          quoteTotal: 8500,
          status: 'in_progress',
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredQuotes = useMemo(() => {
    const sorted = [...quotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    switch (activeTab) {
      case 'active':
        return sorted.filter(q => !['completed', 'draft'].includes(q.status));
      case 'completed':
        return sorted.filter(q => q.status === 'completed');
      default:
        return sorted;
    }
  }, [quotes, activeTab]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="My Jobs" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="My Jobs" showBackButton />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tabButton,
              activeTab === tab.key ? styles.tabButtonActive : styles.tabButtonInactive
            ]}
          >
            <Text style={[
              styles.tabButtonText,
              activeTab === tab.key ? styles.tabButtonTextActive : styles.tabButtonTextInactive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {filteredQuotes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome5 name="briefcase" size={32} color="#D4D4D8" />
            </View>
            <Text style={styles.emptyTitle}>No jobs yet</Text>
            <Text style={styles.emptyDescription}>
              Browse contractors to find the perfect match for your home project.
            </Text>
            <Button
              title="Browse Contractors"
              onPress={() => navigation.navigate('Home')}
              style={styles.emptyButton}
              textStyle={styles.emptyButtonText}
            />
          </View>
        ) : (
          filteredQuotes.map(quote => {
            const badge = getStatusBadge(quote.status);
            return (
              <View key={quote.id} style={styles.jobCard}>
                <View style={styles.jobCardMain}>
                  <Image
                    source={{ uri: quote.contractorImage }}
                    style={styles.contractorImage}
                  />
                  <View style={styles.jobCardContent}>
                    <View style={styles.jobCardHeader}>
                      <View style={styles.jobCardInfo}>
                        <Text style={styles.contractorName} numberOfLines={1}>
                          {quote.contractorName}
                        </Text>
                        <Text style={styles.serviceType}>{quote.serviceType}</Text>
                      </View>
                      {quote.quoteTotal > 0 && (
                        <Text style={styles.quoteTotal}>${quote.quoteTotal.toLocaleString()}</Text>
                      )}
                    </View>

                    <View style={styles.jobCardFooter}>
                      <View style={[styles.statusBadge, { backgroundColor: badge.bgColor }]}>
                        <View style={[styles.statusDot, { backgroundColor: badge.dotColor }]} />
                        <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                      <Text style={styles.dateText}>{formatDate(quote.createdAt)}</Text>
                    </View>

                    {badge.action && (
                      <TouchableOpacity
                        style={styles.actionLink}
                        onPress={() => navigation.navigate(badge.action!.page, { quoteId: quote.id })}
                      >
                        <Text style={styles.actionLinkText}>{badge.action.label}</Text>
                        <FontAwesome5 name="arrow-right" size={10} color="#f43f5e" />
                      </TouchableOpacity>
                    )}

                    {quote.status === 'completed' && !quote.hasReview && (
                      <TouchableOpacity
                        style={styles.actionLink}
                        onPress={() => navigation.navigate('ReviewScreen', { quoteId: quote.id })}
                      >
                        <FontAwesome5 name="star" size={12} color="#d97706" style={{ marginRight: 6 }} />
                        <Text style={styles.reviewLinkText}>Leave a Review</Text>
                        <FontAwesome5 name="arrow-right" size={10} color="#d97706" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: '#111827',
  },
  tabButtonInactive: {
    backgroundColor: '#f3f4f6',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  tabButtonTextInactive: {
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  jobCardMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  contractorImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  jobCardContent: {
    flex: 1,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobCardInfo: {
    flex: 1,
    marginRight: 8,
  },
  contractorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  serviceType: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  quoteTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  jobCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f43f5e',
    marginRight: 4,
  },
  reviewLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  bottomSpacer: {
    height: 20,
  },
});
