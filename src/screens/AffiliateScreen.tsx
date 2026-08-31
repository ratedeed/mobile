import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getAffiliateStats, requestAffiliatePayout, createAffiliateStripeConnect, applyReferralCode } from '../utils/apiClient';
import { BouncingDotsLoader, BouncingRefreshScrollView } from '../components/common';

export default function AffiliateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [affiliateBalance, setAffiliateBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [hasStripeConnected, setHasStripeConnected] = useState(false);
  const [contractors, setContractors] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'contractors' | 'earnings' | 'payouts'>('contractors');

  // Promo / Referral Code Redemption State
  const [inputCode, setInputCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);

  // Payout Modal State
  const [showModal, setShowModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('stripe');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const handleApplyCode = async () => {
    if (!inputCode.trim()) {
      Alert.alert('Empty Code', 'Please enter a referral or promo code.');
      return;
    }
    try {
      setApplyingCode(true);
      const res = await applyReferralCode(inputCode.trim());
      Alert.alert('Success', res.message || 'Referral code applied successfully!');
      setInputCode('');
      fetchStats(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to apply referral code');
    } finally {
      setApplyingCode(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async (isPullToRefresh = false) => {
    try {
      if (isPullToRefresh) {
        setRefreshing(true);
      } else if (!referralCode) {
        setLoading(true);
      }
      const res = await getAffiliateStats();
      if (res) {
        setReferralCode(res.referralCode || '');
        setReferralLink(res.referralLink || '');
        setHasStripeConnected(!!res.hasStripeConnected);
        setAffiliateBalance(res.affiliateBalance || 0);
        setPendingBalance(res.pendingBalance || 0);
        setTotalEarned(res.totalAffiliateEarned || 0);
        setContractors(res.referredContractors || []);
        setEarnings(res.earnings || []);
        setPayouts(res.payouts || []);
      }
    } catch (err: any) {
      console.error('Error fetching affiliate stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleConnectStripe = async () => {
    try {
      setConnectingStripe(true);
      const res = await createAffiliateStripeConnect();
      if (res?.url) {
        await WebBrowser.openBrowserAsync(res.url);
        fetchStats();
      } else {
        Alert.alert('Error', 'Failed to generate Stripe onboarding link.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start Stripe Express onboarding');
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await Clipboard.setStringAsync(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        message: `Join Ratedeed, America's trusted contractor marketplace! Sign up using my referral link: ${referralLink}`,
      });
    } catch (error: any) {
      console.error('Error sharing link:', error);
    }
  };

  const handleRequestPayoutSubmit = async () => {
    if (!hasStripeConnected) {
      Alert.alert('Stripe Account Required', 'You must connect your Stripe account before requesting affiliate payouts.');
      return;
    }
    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt < 10) {
      Alert.alert('Invalid Amount', 'Minimum payout threshold is $10.00');
      return;
    }
    if (amt > affiliateBalance / 100) {
      Alert.alert('Insufficient Balance', 'Amount exceeds available balance');
      return;
    }

    try {
      setSubmittingPayout(true);
      await requestAffiliatePayout({
        amount: Math.round(amt * 100),
        payoutMethod,
        payoutDetails,
      });
      Alert.alert('Payout Requested', 'Your payout request has been submitted for approval.');
      setShowModal(false);
      setPayoutAmount('');
      fetchStats();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit payout request');
    } finally {
      setSubmittingPayout(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }} className="bg-slate-50 dark:bg-neutral-950 justify-center items-center">
        <BouncingDotsLoader size="large" color="#4F46E5" />
        <Text className="text-slate-500 dark:text-neutral-400 text-sm mt-4 font-medium">Loading Partner Program...</Text>
      </View>
    );
  }

  return (
    <BouncingRefreshScrollView
      style={{ flex: 1 }}
      className="bg-slate-50 dark:bg-neutral-950"
      contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16, paddingTop: 16 }}
      refreshing={refreshing}
      onRefresh={() => fetchStats(true)}
    >
      {/* Top Banner */}
      <View className="bg-slate-900 rounded-3xl p-6 mb-5 border border-slate-800">
        <View className="flex-row items-center gap-2 mb-2">
          <View className="bg-amber-400/20 border border-amber-400/40 px-3 py-1 rounded-full">
            <Text className="text-amber-400 text-xs font-bold uppercase">Partner Program</Text>
          </View>
        </View>
        <Text className="text-white text-2xl font-extrabold mb-2">
          Earn Lifetime Partner Commissions
        </Text>
        <Text className="text-slate-300 text-xs leading-5">
          Refer contractors and earn <Text className="text-amber-400 font-bold">4% of the total project value</Text> (from our 5% platform fee) on all jobs completed in their first <Text className="text-white font-bold">90 days</Text>.
        </Text>
      </View>

      {/* Stripe Connection Alert Banner */}
      {!hasStripeConnected && (
        <View className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-amber-900 dark:text-amber-200 font-bold text-xs">Stripe Account Required</Text>
            <Text className="text-amber-700 dark:text-amber-300 text-[11px] mt-0.5">Connect your Stripe account to earn & receive automated payouts.</Text>
          </View>
          <TouchableOpacity
            onPress={handleConnectStripe}
            disabled={connectingStripe}
            className="bg-amber-600 px-3 py-2 rounded-xl min-w-[110px] items-center justify-center"
          >
            {connectingStripe ? (
              <BouncingDotsLoader size="small" color="#fff" />
            ) : (
              <Text className="text-white font-bold text-xs">Connect Stripe</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Pending Balance Banner if applicable */}
      {pendingBalance > 0 && (
        <View className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-amber-900 dark:text-amber-200 font-bold text-xs uppercase">Pending Earnings</Text>
            <Text className="text-amber-950 dark:text-amber-100 text-2xl font-black mt-0.5">${(pendingBalance / 100).toFixed(2)}</Text>
            <Text className="text-amber-700 dark:text-amber-300 text-[11px] mt-0.5">
              {!hasStripeConnected ? 'Connect your bank account to unlock and credit these earnings.' : 'Earnings being processed.'}
            </Text>
          </View>
          {!hasStripeConnected && (
            <TouchableOpacity
              onPress={handleConnectStripe}
              disabled={connectingStripe}
              className="bg-amber-600 px-3 py-2 rounded-xl items-center justify-center"
            >
              <Text className="text-white font-bold text-xs">Unlock</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Balance Card */}
      <View className="bg-white dark:bg-neutral-900 rounded-2xl p-5 mb-5 border border-slate-200 dark:border-neutral-800 shadow-sm flex-row items-center justify-between">
        <View>
          <Text className="text-slate-400 dark:text-neutral-500 text-xs uppercase font-bold mb-1">Available Balance</Text>
          <Text className="text-slate-900 dark:text-white text-3xl font-black">${(affiliateBalance / 100).toFixed(2)}</Text>
          <Text className="text-emerald-600 text-xs font-semibold mt-1">
            Total Earned: ${(totalEarned / 100).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={!hasStripeConnected ? handleConnectStripe : () => setShowModal(true)}
          disabled={hasStripeConnected && affiliateBalance < 1000}
          className={`px-4 py-3 rounded-xl ${hasStripeConnected && affiliateBalance < 1000 ? 'bg-slate-200 dark:bg-neutral-800' : 'bg-indigo-600'}`}
        >
          <Text className={`font-bold text-xs ${hasStripeConnected && affiliateBalance < 1000 ? 'text-slate-500 dark:text-neutral-500' : 'text-white'}`}>
            {!hasStripeConnected ? 'Connect Stripe' : affiliateBalance < 1000 ? 'Min $10' : 'Withdraw'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Referral Link Box */}
      {/* Referral Link Card */}
      <View className="bg-white dark:bg-neutral-900 rounded-2xl p-5 mb-5 border border-slate-200 dark:border-neutral-800 shadow-sm">
        <Text className="text-slate-900 dark:text-white font-bold text-base mb-1">Your Referral Link</Text>
        <Text className="text-slate-500 dark:text-neutral-400 text-xs mb-3">Share this link to automatically credit signups to your account.</Text>

        <View className="bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl p-3 mb-3">
          <Text className="text-slate-800 dark:text-neutral-200 font-mono text-xs select-all" numberOfLines={1}>
            {referralLink}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handleCopyLink}
            className="flex-1 bg-indigo-600 rounded-xl py-3 items-center justify-center"
          >
            <Text className="text-white font-bold text-xs">{copied ? '✓ Copied!' : 'Copy Link'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            className="flex-1 bg-slate-900 dark:bg-neutral-800 rounded-xl py-3 items-center justify-center"
          >
            <Text className="text-white font-bold text-xs">Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Redeem Promo / Referral Code Card */}
      <View className="bg-white dark:bg-neutral-900 rounded-2xl p-5 mb-5 border border-slate-200 dark:border-neutral-800 shadow-sm">
        <Text className="text-slate-900 dark:text-white font-bold text-base mb-1">Have a Referral or Promo Code?</Text>
        <Text className="text-slate-500 dark:text-neutral-400 text-xs mb-3">Enter a partner or friend's invite code to link your account.</Text>

        <View className="flex-row gap-2">
          <TextInput
            placeholder="e.g. PARTNER123"
            value={inputCode}
            onChangeText={setInputCode}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!applyingCode}
            className="flex-1 border border-slate-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-slate-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50"
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity
            onPress={handleApplyCode}
            disabled={applyingCode || !inputCode.trim()}
            className="bg-indigo-600 rounded-xl px-5 py-3 items-center justify-center"
            style={{ opacity: applyingCode || !inputCode.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold text-xs">{applyingCode ? 'Applying...' : 'Apply'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View className="bg-slate-200/80 dark:bg-neutral-800 p-1 rounded-xl flex-row mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab('contractors')}
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'contractors' ? 'bg-white dark:bg-neutral-700 shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'contractors' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400'}`}>
            Referred ({contractors.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('earnings')}
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'earnings' ? 'bg-white dark:bg-neutral-700 shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'earnings' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400'}`}>
            Earnings ({earnings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('payouts')}
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'payouts' ? 'bg-white dark:bg-neutral-700 shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'payouts' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-neutral-400'}`}>
            Payouts ({payouts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'contractors' && (
        <View className="gap-3">
          {contractors.length === 0 ? (
            <View className="bg-white dark:bg-neutral-900 rounded-2xl p-8 items-center border border-slate-200 dark:border-neutral-800">
              <FontAwesome5 name="users" size={32} color="#94a3b8" />
              <Text className="text-slate-700 dark:text-neutral-300 font-bold text-sm mt-3">No Referrals Yet</Text>
              <Text className="text-slate-400 dark:text-neutral-500 text-xs text-center mt-1">
                Share your referral link with contractors to start earning 4% on their completed projects (out of our 5% fee).
              </Text>
            </View>
          ) : (
            contractors.map((c, idx) => {
              const name = c.companyName || c.name || 'Contractor';
              const dateVal = c.signupDate || c.joinedAt || c.createdAt;
              const dateStr = dateVal ? new Date(dateVal).toLocaleDateString() : 'Recently';
              return (
                <View key={c.id || c._id || idx} className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-slate-200 dark:border-neutral-800 flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-slate-900 dark:text-white font-bold text-sm">{name}</Text>
                    <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-0.5">Joined {dateStr} {c.category ? `• ${c.category}` : ''}</Text>
                  </View>
                  <View className="items-end">
                    <View className={`px-2.5 py-0.5 rounded-full ${c.daysRemaining > 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-slate-100 dark:bg-neutral-800'}`}>
                      <Text className={`text-[10px] font-bold ${c.daysRemaining > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-neutral-400'}`}>
                        {c.daysRemaining > 0 ? `${c.daysRemaining} days left` : 'Window expired'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {activeTab === 'earnings' && (
        <View className="gap-3">
          {earnings.length === 0 ? (
            <View className="bg-white dark:bg-neutral-900 rounded-2xl p-8 items-center border border-slate-200 dark:border-neutral-800">
              <FontAwesome5 name="dollar-sign" size={32} color="#94a3b8" />
              <Text className="text-slate-700 dark:text-neutral-300 font-bold text-sm mt-3">No Earnings Yet</Text>
              <Text className="text-slate-400 dark:text-neutral-500 text-xs text-center mt-1">
                Commissions will appear here when your referred contractors complete funded milestones.
              </Text>
            </View>
          ) : (
            earnings.map((e, idx) => {
              const name = e.referredContractor?.companyName || e.contractorName || 'Commission';
              const dateVal = e.createdAt;
              const dateStr = dateVal ? new Date(dateVal).toLocaleDateString() : '';
              const jobId = (e.job?._id || e.job || e.jobId || e._id || '').toString().slice(-6);
              const commAmount = e.commissionAmount != null ? e.commissionAmount : (e.amount || 0);
              const isPending = e.status === 'pending';
              return (
                <View key={e._id || idx} className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-slate-200 dark:border-neutral-800 flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className="text-slate-900 dark:text-white font-bold text-sm">{name}</Text>
                    <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-0.5">{dateStr} {jobId ? `• Job #${jobId}` : ''}</Text>
                  </View>
                  <View className="items-end">
                    <Text className={`font-bold text-sm ${isPending ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      +${(commAmount / 100).toFixed(2)}
                    </Text>
                    <Text className="text-slate-400 dark:text-neutral-500 text-[10px] uppercase font-semibold mt-0.5">{e.status || 'available'}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {activeTab === 'payouts' && (
        <View className="gap-3">
          {payouts.length === 0 ? (
            <View className="bg-white dark:bg-neutral-900 rounded-2xl p-8 items-center border border-slate-200 dark:border-neutral-800">
              <FontAwesome5 name="wallet" size={32} color="#94a3b8" />
              <Text className="text-slate-700 dark:text-neutral-300 font-bold text-sm mt-3">No Payout Requests</Text>
              <Text className="text-slate-400 dark:text-neutral-500 text-xs text-center mt-1">
                You haven't requested any payouts yet. Minimum payout is $10.00.
              </Text>
            </View>
          ) : (
            payouts.map((p, idx) => (
              <View key={p._id || idx} className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-slate-200 dark:border-neutral-800 flex-row items-center justify-between">
                <View>
                  <Text className="text-slate-900 dark:text-white font-bold text-sm">${(p.amount / 100).toFixed(2)}</Text>
                  <Text className="text-slate-400 dark:text-neutral-500 text-xs mt-0.5">{new Date(p.createdAt).toLocaleDateString()} • via {p.payoutMethod || 'Stripe'}</Text>
                </View>
                <View className="items-end">
                  <View className={`px-2.5 py-0.5 rounded-full ${p.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : p.status === 'pending' || p.status === 'requested' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'}`}>
                    <Text className={`text-[10px] font-bold capitalize ${p.status === 'completed' ? 'text-emerald-700 dark:text-emerald-300' : p.status === 'pending' || p.status === 'requested' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                      {p.status || 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Payout Request Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center p-4">
          <View className="bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-slate-200 dark:border-neutral-800 gap-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-slate-900 dark:text-white font-extrabold text-lg">Request Affiliate Payout</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text className="text-slate-400 text-lg font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-slate-600 dark:text-neutral-400 text-xs font-bold mb-1">Payout Destination</Text>
              <View className="bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl p-3">
                <Text className="text-slate-900 dark:text-white font-bold text-xs">Stripe Express Direct Deposit</Text>
                <Text className="text-slate-500 dark:text-neutral-400 text-[11px] mt-0.5">Automated payout directly to your connected bank account.</Text>
              </View>
            </View>

            <View>
              <Text className="text-slate-600 dark:text-neutral-400 text-xs font-bold mb-1">Amount ($)</Text>
              <TextInput
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                keyboardType="decimal-pad"
                placeholder="e.g. 25.00"
                className="bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-semibold"
              />
            </View>

            <View>
              <Text className="text-slate-600 dark:text-neutral-400 text-xs font-bold mb-1">Payout Account (Email/Phone)</Text>
              <TextInput
                value={payoutDetails}
                onChangeText={setPayoutDetails}
                placeholder="PayPal email, Zelle phone, or bank details"
                className="bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm font-semibold"
              />
            </View>

            <TouchableOpacity
              onPress={handleRequestPayoutSubmit}
              disabled={submittingPayout}
              className="bg-indigo-600 rounded-xl py-3.5 items-center justify-center mt-2"
            >
              {submittingPayout ? (
                <BouncingDotsLoader size="small" color="#FFF" />
              ) : (
                <Text className="text-white font-bold text-sm">Submit Withdrawal Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </BouncingRefreshScrollView>
  );
}
