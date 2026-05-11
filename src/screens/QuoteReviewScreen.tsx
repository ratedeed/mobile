import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getQuote, updateQuoteStatus, createCheckoutSession } from '../api';

export default function QuoteReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { quoteId } = (route.params || {}) as { quoteId?: string };

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  useEffect(() => {
    if (!quoteId) {
      setError('Missing quote ID.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await getQuote(quoteId);
        setQuote(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load quote.');
      } finally {
        setLoading(false);
      }
    })();
  }, [quoteId]);

  const handleAccept = async () => {
    if (!quoteId) return;
    setActionLoading('accept');
    try {
      await updateQuoteStatus(quoteId, 'accepted');
      const checkoutData = await createCheckoutSession(quoteId);
      if (checkoutData?.url) {
        // On mobile we can't open Stripe Checkout directly in-app the same way
        // Navigate to PaymentFlow which handles native Stripe
        (navigation as any).navigate('PaymentFlow', {
          quoteId,
          totalAmount: quote?.totalAmount || 0,
          contractorName: quote?.contractor?.companyName || quote?.contractor?.businessName || 'Contractor',
          description: quote?.description || 'Home Project',
        });
      } else {
        (navigation as any).navigate('PaymentFlow', {
          quoteId,
          totalAmount: quote?.totalAmount || 0,
          contractorName: quote?.contractor?.companyName || quote?.contractor?.businessName || 'Contractor',
          description: quote?.description || 'Home Project',
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to accept quote.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!quoteId) return;
    setActionLoading('reject');
    try {
      await updateQuoteStatus(quoteId, 'rejected');
      Alert.alert('Quote Declined', 'You have declined this quote.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to decline quote.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-sm text-neutral-500 mt-3">Loading quote...</Text>
      </View>
    );
  }

  if (error || !quote) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
          <FontAwesome5 name="exclamation-triangle" size={24} color="#dc2626" />
        </View>
        <Text className="text-lg font-bold text-neutral-900 mb-2">Quote Not Found</Text>
        <Text className="text-sm text-neutral-500 text-center mb-6">{error || 'We couldn\'t find this quote.'}</Text>
        <Pressable onPress={() => navigation.goBack()} className="bg-indigo-600 px-8 py-3.5 rounded-xl">
          <Text className="text-white font-bold text-sm">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const contractorName = quote.contractor?.companyName || quote.contractor?.businessName || 'Contractor';
  const contractorImage = quote.contractor?.profilePicture || quote.contractor?.imageUrl || '';
  const contractorCategory = quote.contractor?.category || '';
  const lineItems = quote.lineItems || [];
  const total = quote.totalAmount || quote.total || 0;
  const totalInDollars = total > 1000 ? (total / 100).toFixed(2) : total;
  const isPending = (quote.status === 'pending' || quote.status === 'pending_user_approval');

  if (quote.status === 'rejected') {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <View className="w-16 h-16 bg-neutral-100 rounded-full items-center justify-center mb-4">
          <FontAwesome5 name="times" size={24} color="#737373" />
        </View>
        <Text className="text-lg font-bold text-neutral-900 mb-2">Quote Declined</Text>
        <Text className="text-sm text-neutral-500 text-center max-w-xs mb-6">
          You declined this quote from {contractorName}. You can always request a new one.
        </Text>
        <Pressable onPress={() => navigation.goBack()} className="bg-neutral-900 px-8 py-3.5 rounded-xl w-full items-center">
          <Text className="text-white font-bold text-sm">Go Back</Text>
        </Pressable>
      </View>
    );
  }

    return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-neutral-50"
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 16 }}>
                {/* Accepted Banner */}
        {quote.status === 'accepted' && (
          <View className="bg-emerald-50 rounded-xl p-4 flex-row items-center border border-emerald-100 mb-4" style={{ gap: 12 }}>
            <View className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm">
              <FontAwesome5 name="check-circle" size={20} color="#059669" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-emerald-900">Quote Accepted!</Text>
              <Text className="text-xs text-emerald-700 mt-0.5">Proceed to payment to get started.</Text>
            </View>
          </View>
        )}

        {/* Contractor Card */}
        <View className="bg-white rounded-xl p-4 flex-row items-center border border-neutral-100 mb-4" style={{ gap: 12 }}>
          {contractorImage ? (
            <Image source={{ uri: contractorImage }} className="w-14 h-14 rounded-lg" resizeMode="cover" />
          ) : (
            <View className="w-14 h-14 rounded-lg bg-neutral-200 items-center justify-center">
              <FontAwesome5 name="star" size={18} color="#a3a3a3" />
            </View>
          )}
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-bold text-neutral-900" numberOfLines={1}>{contractorName}</Text>
            {contractorCategory ? (
              <Text className="text-xs text-neutral-500">{contractorCategory}</Text>
            ) : null}
          </View>
          <View className={`flex-row items-center px-2.5 py-1 rounded-full ${isPending ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <FontAwesome5 name={isPending ? 'clock' : 'check-circle'} size={10} color={isPending ? '#b45309' : '#059669'} />
            <Text className={`text-xs font-bold ml-1 ${isPending ? 'text-amber-700' : 'text-emerald-700'}`}>
              {isPending ? 'Pending' : 'Accepted'}
            </Text>
          </View>
        </View>

        {/* Contractor Notes */}
        {quote.contractorNotes ? (
          <View className="bg-white rounded-xl p-4 border border-neutral-100 mb-4">
            <Text className="text-sm font-semibold text-neutral-900 mb-2">Message from {contractorName.split(' ')[0]}</Text>
            <Text className="text-sm text-neutral-600 leading-5">{quote.contractorNotes}</Text>
          </View>
        ) : null}

        {/* Line Items */}
        {lineItems.length > 0 ? (
          <View className="bg-white rounded-xl p-4 border border-neutral-100 mb-4">
            <Text className="text-sm font-semibold text-neutral-900 mb-3">Quote Breakdown</Text>
            {lineItems.map((item: any, i: number) => (
              <View key={i} className="flex-row justify-between items-start mb-3">
                <View className="flex-1 min-w-0 mr-3">
                  <Text className="text-sm font-medium text-neutral-900">{item.description || item.label || `Item ${i + 1}`}</Text>
                  {item.description && item.label ? (
                    <Text className="text-xs text-neutral-500 mt-0.5">{item.description}</Text>
                  ) : null}
                </View>
                <Text className="text-sm font-semibold text-neutral-900">
                  ${(item.amount > 1000 ? (item.amount / 100).toFixed(2) : item.amount).toLocaleString()}
                </Text>
              </View>
            ))}

            {total > 0 && (
              <>
                <View className="border-t border-neutral-200 my-3" />
                <View className="flex-row justify-between items-center">
                  <Text className="text-base font-bold text-neutral-900">Total</Text>
                  <Text className="text-xl font-bold text-neutral-900">${Number(totalInDollars).toLocaleString()}</Text>
                </View>
              </>
            )}
          </View>
        ) : null}

        {/* Description */}
        {quote.description ? (
          <View className="bg-white rounded-xl p-4 border border-neutral-100 mb-4">
            <Text className="text-sm font-semibold text-neutral-900 mb-2">Project Description</Text>
            <Text className="text-sm text-neutral-600 leading-5">{quote.description}</Text>
          </View>
        ) : null}

        {/* Photos / Areas of Work */}
        {quote.photos && quote.photos.length > 0 ? (
          <View className="bg-white rounded-xl p-4 border border-neutral-100 mb-4">
            <Text className="text-sm font-semibold text-neutral-900 mb-3">Areas of Work</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
              {quote.photos.map((photo, i) => (
                <View key={i} className="px-2">
                  <Image 
                    source={{ uri: photo }} 
                    className="w-48 h-32 rounded-xl bg-neutral-100" 
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        

        {/* Timeline */}
        {(quote.estimatedStartDate || quote.estimatedCompletionDate) ? (
          <View className="bg-white rounded-xl p-4 border border-neutral-100 mb-4">
            <Text className="text-sm font-semibold text-neutral-900 mb-3">Project Timeline</Text>
            <View className="flex-row items-center" style={{ gap: 16 }}>
              {quote.estimatedStartDate && (
                <View className="flex-1 flex-row items-center" style={{ gap: 10 }}>
                  <View className="w-9 h-9 rounded-full bg-indigo-50 items-center justify-center">
                    <FontAwesome5 name="calendar-plus" size={14} color="#4F46E5" />
                  </View>
                  <View>
                    <Text className="text-[11px] font-medium text-neutral-400 uppercase">Start Date</Text>
                    <Text className="text-sm font-bold text-neutral-800">
                      {new Date(quote.estimatedStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </View>
              )}
              {quote.estimatedCompletionDate && (
                <View className="flex-1 flex-row items-center" style={{ gap: 10 }}>
                  <View className="w-9 h-9 rounded-full bg-emerald-50 items-center justify-center">
                    <FontAwesome5 name="calendar-check" size={14} color="#059669" />
                  </View>
                  <View>
                    <Text className="text-[11px] font-medium text-neutral-400 uppercase">Completion</Text>
                    <Text className="text-sm font-bold text-neutral-800">
                      {new Date(quote.estimatedCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Escrow Notice */}
        <View className="bg-emerald-50 rounded-xl p-4 flex-row items-start border border-emerald-100 mb-4" style={{ gap: 12 }}>
          <FontAwesome5 name="shield-alt" size={18} color="#059669" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-emerald-800">Escrow Protection</Text>
            <Text className="text-xs text-emerald-700 mt-0.5 leading-4">
              Your payment will be held in escrow until the job is complete. You have full control over when to release funds.
            </Text>
          </View>
        </View>

        <View className="h-32" />
      </ScrollView>

      {/* Bottom CTA for pending quotes */}
      {(isPending || quote.status === 'accepted') && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-3">
          <Pressable
            onPress={handleAccept}
            disabled={actionLoading !== null}
            className={`py-3.5 rounded-xl items-center flex-row justify-center mb-2 ${
              actionLoading ? 'bg-indigo-400' : 'bg-indigo-600'
            }`}
            style={{ gap: 8 }}
          >
            {actionLoading === 'accept' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : null}
            <Text className="text-white font-bold text-sm">
              {quote.status === 'accepted' ? 'Continue to Payment' : actionLoading === 'accept' ? 'Accepting...' : `Accept & Pay ${Number(totalInDollars).toLocaleString()}`}
            </Text>
            {actionLoading !== 'accept' && <FontAwesome5 name="arrow-right" size={12} color="#fff" />}
          </Pressable>
          {isPending && (<Pressable onPress={() => setShowDeclineConfirm(true)} disabled={actionLoading !== null} className="py-2 items-center"> <Text className="text-sm text-neutral-500">Decline this quote</Text> </Pressable>)}
        </View>
      )}

      {/* Decline Confirmation Modal */}
      {showDeclineConfirm && (
        <View className="absolute inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="absolute inset-0" onPress={() => setShowDeclineConfirm(false)} />
          <View className="bg-white rounded-t-2xl p-6 w-full">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-neutral-900">Decline Quote?</Text>
              <Pressable onPress={() => setShowDeclineConfirm(false)} className="w-8 h-8 items-center justify-center rounded-full">
                <FontAwesome5 name="times" size={14} color="#737373" />
              </Pressable>
            </View>
            <Text className="text-sm text-neutral-500 mb-4">
              Are you sure you want to decline this quote from {contractorName}? You can always request a new one later.
            </Text>
            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable
                onPress={() => setShowDeclineConfirm(false)}
                className="flex-1 py-3 rounded-xl items-center border border-neutral-200"
              >
                <Text className="text-sm font-semibold text-neutral-900">Keep Quote</Text>
              </Pressable>
              <Pressable
                onPress={handleReject}
                disabled={actionLoading !== null}
                className="flex-1 py-3 rounded-xl items-center bg-neutral-900"
              >
                {actionLoading === 'reject' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">Decline</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}