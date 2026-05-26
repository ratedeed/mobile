import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet, useColorScheme } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createCheckoutSession, createPaymentIntent, getQuote } from '../api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useStripe, usePlatformPay, confirmPlatformPayPayment, PlatformPay } from '@stripe/stripe-react-native';

const STEP_LABELS = ['Review', 'Payment', 'Confirmed'];

export default function PaymentFlowScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { isPlatformPaySupported } = usePlatformPay();

  const quoteId = route.params?.quoteId || '';
  const quoteTotal = route.params?.totalAmount || 0;
  const contractorName = route.params?.contractorName || 'Contractor';
  const quoteDescription = route.params?.description || '';

  const [currentStep, setCurrentStep] = useState(0);
  const [paying, setPaying] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  useEffect(() => {
    async function checkApplePay() {
      const supported = await isPlatformPaySupported(
        Platform.OS === 'android' ? { googlePay: { testEnv: true } } : {}
      );
      setApplePayAvailable(supported);
    }
    if (Platform.OS === 'ios') {
      checkApplePay();
    }
  }, [isPlatformPaySupported]);

  const handleApplePay = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple Pay', 'Apple Pay is only available on iOS devices.');
      return;
    }
    try {
      setPaying(true);
      const response = await createPaymentIntent(quoteId);
      if (!response?.clientSecret) {
        Alert.alert('Payment Error', 'Could not initialize Apple Pay session.');
        return;
      }
      const { clientSecret } = response;

      const { paymentIntent, error } = await confirmPlatformPayPayment(
        clientSecret,
        {
          applePay: {
            cartItems: [
              {
                label: quoteDescription || 'Project Payment',
                amount: String((quoteTotal / 100).toFixed(2)),
                paymentType: PlatformPay.PaymentType.Immediate,
              },
            ],
            merchantCountryCode: 'US',
            currencyCode: 'USD',
          },
        }
      );

      if (error) {
        Alert.alert('Payment Failed', error.message || 'Apple Pay could not be completed.');
      } else if (paymentIntent?.status === 'Succeeded') {
        setCurrentStep(2);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Apple Pay failed to initialize.');
    } finally {
      setPaying(false);
    }
  };

  const handlePayment = async () => {
    try {
      setPaying(true);
      const { url } = await createCheckoutSession(quoteId);
      
      const result = await WebBrowser.openAuthSessionAsync(url, 'ratedeed://profile');
      
      if (result.type === 'success' && result.url?.includes('job_funded=true')) {
        setCurrentStep(2);
      } else if (result.type === 'success' && result.url?.includes('job_canceled=true')) {
        Alert.alert('Canceled', 'The payment process was canceled.');
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        Alert.alert('Payment Incomplete', 'The payment window was closed before completing the transaction.');
      } else if (result.type === 'locked') {
        Alert.alert('Browser Locked', 'Please unlock your browser or try again.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to initiate secure payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const verifyPaymentStatus = async () => {
    try {
      setPaying(true);
      const quote = await getQuote(quoteId);
      if (quote && (quote.status === 'accepted' || quote.status === 'paid' || quote.jobId)) {
        setCurrentStep(2);
      } else {
        Alert.alert('Payment Not Confirmed', 'We could not confirm your payment yet. If you just paid, please wait a moment and try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not verify payment status.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#09090B' : '#ffffff' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Math.max(insets.top, 12), paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' }}>
        {currentStep === 0 && (
          <Pressable onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}>
            <FontAwesome5 name="chevron-left" size={18} color={isDark ? "#ffffff" : "#171717"} />
          </Pressable>
        )}
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717', flex: 1, textAlign: 'center' }}>
          {currentStep === 2 ? 'Payment Complete' : 'Secure Payment'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Steps */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
        {STEP_LABELS.map((label, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <View key={label} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDone ? '#10b981' : isActive ? '#171717' : '#f5f5f5'
              }}>
                {isDone ? (
                  <FontAwesome5 name="check" size={10} color="#fff" />
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: isActive ? 'white' : '#a3a3a3' }}>{i + 1}</Text>
                )}
              </View>
              <Text style={{ fontSize: 9, marginTop: 4, fontWeight: '500', color: isActive ? '#171717' : '#a3a3a3' }}>{label}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Step 0: Review */}
        {currentStep === 0 && (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e5e5e5', padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>{contractorName}</Text>
                  <Text style={{ fontSize: 12, color: isDark ? '#a3a3a3' : '#737373' }}>Service Fee Included</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>${(quoteTotal / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>

            <View style={{ backgroundColor: '#171717', borderRadius: 16, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 1 }}>Total Amount</Text>
              <Text style={{ fontSize: 30, fontWeight: 'bold', color: 'white', marginTop: 4 }}>${(quoteTotal / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>

            <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12 }}>
              <FontAwesome5 name="shield-alt" size={18} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#065f46' }}>Escrow Protection</Text>
                <Text style={{ fontSize: 12, color: '#047857', marginTop: 4, lineHeight: 18 }}>
                  Your payment will be held in escrow. Funds are only released when you confirm the job is complete.
                </Text>
              </View>
            </View>

            {applePayAvailable && (
              <Pressable
                onPress={handleApplePay}
                style={styles.applePayBtn}
              >
                <View style={styles.applePayContent}>
                  <FontAwesome5 name="apple" size={18} color="#fff" brand solid />
                  <Text style={styles.applePayText}>Pay</Text>
                </View>
              </Pressable>
            )}

            <View style={{ height: 12, alignItems: 'center', justifyContent: 'center' }}>
              {applePayAvailable && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5' }} />
                  <Text style={{ fontSize: 11, color: '#a3a3a3', fontWeight: '500' }}>OR</Text>
                  <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5' }} />
                </View>
              )}
            </View>

            <Pressable
              onPress={handlePayment}
              disabled={paying}
              style={{
                width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16,
                backgroundColor: paying ? '#d4d4d4' : '#4F46E5'
              }}
            >
              {paying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FontAwesome5 name="lock" size={14} color="#fff" />
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>Secure Checkout</Text>
                </>
              )}
            </Pressable>
            
            <Pressable
              onPress={verifyPaymentStatus}
              disabled={paying}
              style={{
                width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12,
                backgroundColor: paying ? '#f5f5f5' : '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7'
              }}
            >
              <FontAwesome5 name="sync" size={12} color={isDark ? '#a3a3a3' : '#737373'} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#a3a3a3' : '#52525b' }}>Verify Payment Status</Text>
            </Pressable>
            
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FontAwesome5 name="stripe" size={32} color="#6366F1" />
                <Text style={{ fontSize: 10, color: '#a3a3a3', fontWeight: '500' }}>PCI Compliant Checkout</Text>
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Confirmed */}
        {currentStep === 2 && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={{ width: 80, height: 80, backgroundColor: '#ecfdf5', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <FontAwesome5 name="check" size={32} color="#10b981" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>Payment Confirmed!</Text>
            <Text style={{ fontSize: 30, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717', marginTop: 8 }}>${(quoteTotal / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <Text style={{ fontSize: 14, color: isDark ? '#a3a3a3' : '#737373' }}>paid to {contractorName}</Text>

            <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, marginTop: 32, width: '100%' }}>
              <FontAwesome5 name="shield-alt" size={18} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#065f46' }}>Funds Held in Escrow</Text>
                <Text style={{ fontSize: 12, color: '#047857', marginTop: 4, lineHeight: 18 }}>
                  Your payment is securely held and will be released once you confirm the job is complete.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('ActiveJobs')}
              style={{ width: '100%', paddingVertical: 14, backgroundColor: '#4F46E5', borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 24 }}
            >
              <FontAwesome5 name="briefcase" size={14} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>View My Jobs</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Explore')} style={{ marginTop: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: isDark ? '#a3a3a3' : '#737373' }}>Back to Home</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Apple Pay + General Styles */}
    </View>
  );
}

const styles = StyleSheet.create({
  applePayBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    marginTop: 16,
  },
  applePayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  applePayText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
