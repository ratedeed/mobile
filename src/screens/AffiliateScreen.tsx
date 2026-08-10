import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getAffiliateStats, requestAffiliatePayout } from '../utils/apiClient';

export default function AffiliateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [affiliateBalance, setAffiliateBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [hasStripeConnected, setHasStripeConnected] = useState(false);
  const [contractors, setContractors] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'contractors' | 'earnings' | 'payouts'>('contractors');

  // Payout Modal State
  const [showModal, setShowModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('stripe');
  const [payoutDetails, setPayoutDetails] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await getAffiliateStats();
      if (res) {
        setReferralCode(res.referralCode || '');
        setReferralLink(res.referralLink || '');
        setHasStripeConnected(!!res.hasStripeConnected);
        setAffiliateBalance(res.affiliateBalance || 0);
        setTotalEarned(res.totalAffiliateEarned || 0);
        setContractors(res.referredContractors || []);
        setEarnings(res.earnings || []);
        setPayouts(res.payouts || []);
      }
    } catch (err: any) {
      console.error('Error fetching affiliate stats:', err);
    } finally {
      setLoading(false);
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
      <View style={{ flex: 1, paddingTop: insets.top }} className="bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text className="text-slate-500 text-sm mt-3 font-medium">Loading Affiliate Partner Portal...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      className="bg-slate-50"
      contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16, paddingTop: 16 }}
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
          Refer contractors and earn <Text className="text-amber-400 font-bold">1% of the 5% platform fee</Text> collected on their jobs for their first <Text className="text-white font-bold">90 days</Text>.
        </Text>
      </View>

      {/* Stripe Connection Alert Banner */}
      {!hasStripeConnected && (
        <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-amber-900 font-bold text-xs">Stripe Account Required</Text>
            <Text className="text-amber-700 text-[11px] mt-0.5">Connect your Stripe account to enable automated payouts.</Text>
          </View>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('ContractorOnboarding')}
            className="bg-amber-600 px-3 py-2 rounded-xl"
          >
            <Text className="text-white font-bold text-xs">Connect Stripe</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Balance Card */}
      <View className="bg-white rounded-2xl p-5 mb-5 border border-slate-200 shadow-sm flex-row items-center justify-between">
        <View>
          <Text className="text-slate-400 text-xs uppercase font-bold mb-1">Available Balance</Text>
          <Text className="text-slate-900 text-3xl font-black">${(affiliateBalance / 100).toFixed(2)}</Text>
          <Text className="text-emerald-600 text-xs font-semibold mt-1">
            Total Earned: ${(totalEarned / 100).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          disabled={!hasStripeConnected || affiliateBalance < 1000}
          className={`px-4 py-3 rounded-xl ${!hasStripeConnected || affiliateBalance < 1000 ? 'bg-slate-200' : 'bg-indigo-600'}`}
        >
          <Text className={`font-bold text-xs ${!hasStripeConnected || affiliateBalance < 1000 ? 'text-slate-500' : 'text-white'}`}>
            {!hasStripeConnected ? 'Connect Stripe' : affiliateBalance < 1000 ? 'Min $10' : 'Withdraw'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Referral Link Box */}
      <View className="bg-white rounded-2xl p-5 mb-5 border border-slate-200 shadow-sm">
        <Text className="text-slate-900 font-bold text-base mb-1">Your Referral Link</Text>
        <Text className="text-slate-500 text-xs mb-3">Share this link to automatically credit signups to your account.</Text>

        <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
          <Text className="text-slate-800 font-mono text-xs select-all" numberOfLines={1}>
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
            className="flex-1 bg-slate-900 rounded-xl py-3 items-center justify-center"
          >
            <Text className="text-white font-bold text-xs">Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View className="bg-slate-200/80 p-1 rounded-xl flex-row mb-4">
        <TouchableOpacity
          onPress={() => setActiveTab('contractors')}
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'contractors' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'contractors' ? 'text-slate-900' : 'text-slate-500'}`}>
            Contractors ({contractors.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('earnings')}
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'earnings' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'earnings' ? 'text-slate-900' : 'text-slate-500'}`}>
            Earnings ({earnings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('payouts')}
          className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'payouts' ? 'bg-white shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-bold ${activeTab === 'payouts' ? 'text-slate-900' : 'text-slate-500'}`}>
            Payouts ({payouts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        {activeTab === 'contractors' && (
          <View>
            {contractors.length === 0 ? (
              <View className="py-8 items-center">
                <Text className="text-slate-400 text-xs font-medium">No referred contractors yet.</Text>
              </View>
            ) : (
              contractors.map((c, i) => (
                <View key={c.id || i} className="py-3 border-b border-slate-100 flex-row justify-between items-center">
                  <View>
                    <Text className="text-slate-900 font-bold text-sm">{c.companyName}</Text>
                    <Text className="text-slate-500 text-xs">{c.category} · Joined {new Date(c.signupDate).toLocaleDateString()}</Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${c.isActiveWindow ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-100'}`}>
                    <Text className={`text-[10px] font-bold ${c.isActiveWindow ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {c.isActiveWindow ? `${c.daysRemaining}d left` : 'Completed'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'earnings' && (
          <View>
            {earnings.length === 0 ? (
              <View className="py-8 items-center">
                <Text className="text-slate-400 text-xs font-medium">No earnings logged yet.</Text>
              </View>
            ) : (
              earnings.map((e, i) => (
                <View key={e._id || i} className="py-3 border-b border-slate-100 flex-row justify-between items-center">
                  <View>
                    <Text className="text-slate-900 font-bold text-xs">{e.referredContractor?.companyName || 'Contractor Job'}</Text>
                    <Text className="text-slate-400 text-[10px]">{new Date(e.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text className="text-emerald-600 font-bold text-sm">
                    +${(e.commissionAmount / 100).toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'payouts' && (
          <View>
            {payouts.length === 0 ? (
              <View className="py-8 items-center">
                <Text className="text-slate-400 text-xs font-medium">No payout requests yet.</Text>
              </View>
            ) : (
              payouts.map((p, i) => (
                <View key={p._id || i} className="py-3 border-b border-slate-100 flex-row justify-between items-center">
                  <View>
                    <Text className="text-slate-900 font-bold text-xs">${(p.amount / 100).toFixed(2)}</Text>
                    <Text className="text-slate-400 text-[10px] uppercase">{p.payoutMethod} · {new Date(p.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text className={`text-xs font-bold capitalize ${p.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {p.status}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* Withdrawal Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6 space-y-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-slate-900 font-extrabold text-lg">Request Affiliate Payout</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text className="text-slate-400 text-lg font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-slate-600 text-xs font-bold mb-1">Payout Method</Text>
              <View className="flex-row gap-2 mb-2">
                {[
                  { id: 'stripe', label: 'Stripe / Bank' },
                  { id: 'paypal', label: 'PayPal' },
                  { id: 'zelle', label: 'Zelle' },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setPayoutMethod(m.id)}
                    className={`flex-1 py-2 rounded-xl border items-center ${
                      payoutMethod === m.id
                        ? 'bg-indigo-50 border-indigo-600'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${payoutMethod === m.id ? 'text-indigo-600' : 'text-slate-600'}`}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text className="text-slate-600 text-xs font-bold mb-1">Amount ($)</Text>
              <TextInput
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                keyboardType="decimal-pad"
                placeholder="e.g. 25.00"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
              />
            </View>

            <View>
              <Text className="text-slate-600 text-xs font-bold mb-1">Payout Account (Email/Phone)</Text>
              <TextInput
                value={payoutDetails}
                onChangeText={setPayoutDetails}
                placeholder="PayPal email, Zelle phone, or bank details"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm font-semibold"
              />
            </View>

            <TouchableOpacity
              onPress={handleRequestPayoutSubmit}
              disabled={submittingPayout}
              className="bg-indigo-600 rounded-xl py-3.5 items-center justify-center mt-2"
            >
              {submittingPayout ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text className="text-white font-bold text-sm">Submit Withdrawal Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
