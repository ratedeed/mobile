import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Platform, StyleSheet, useColorScheme, AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createCheckoutSession, createPaymentIntent, getQuote } from '../api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useStripe, usePlatformPay, confirmPlatformPayPayment, PlatformPay, PlatformPayButton } from '@stripe/stripe-react-native';
import HapticFeedback from '../utils/haptics';
import { BouncingDotsLoader } from '../components/common';

const STEP_LABELS = ['Review', 'Payment', 'Confirmed'];

export default function PaymentFlowScreen() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { isPlatformPaySupported } = usePlatformPay();

  const quoteId = route.params?.quoteId || '';
  const milestoneId = route.params?.milestoneId || '';
  const contractorName = route.params?.contractorName || 'Contractor';
  const quoteDescription = route.params?.description || '';

  const [currentStep, setCurrentStep] = useState(0);
  const [paying, setPaying] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>((route.params?.totalAmount || 0) * 100);
  const [loadingPaymentIntent, setLoadingPaymentIntent] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const isMounted = React.useRef(true);
  const payingRef = React.useRef(false);

  useEffect(() => {
    isMounted.current = true;
    if (!quoteId) {
      Alert.alert('Error', 'Missing quote information. Cannot proceed to payment.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
    return () => {
      isMounted.current = false;
    };
  }, [quoteId]);

  useEffect(() => {
    async function checkApplePay() {
      const supported = await isPlatformPaySupported(
        Platform.OS === 'android' ? { googlePay: { testEnv: __DEV__ } } : {}
      );
      setApplePayAvailable(supported);
    }
    if (Platform.OS === 'ios') {
      checkApplePay();
    }
  }, [isPlatformPaySupported]);

  useEffect(() => {
    async function initPayment() {
      try {
        setLoadingPaymentIntent(true);
        const response = await createPaymentIntent(quoteId, milestoneId);
        if (response?.clientSecret) {
          setClientSecret(response.clientSecret);
          if (response.amount !== undefined) {
            setPaymentAmount(response.amount);
          }
        }
      } catch (err) {
        console.error('Failed to pre-initialize payment intent:', err);
      } finally {
        setLoadingPaymentIntent(false);
      }
    }
    if (quoteId) {
      initPayment();
    } else {
      setLoadingPaymentIntent(false);
    }
  }, [quoteId]);

  const [isPolling, setIsPolling] = useState(false);

  const startPollingPaymentStatus = async (showLoadingIndicator = true) => {
    if (isPolling) return;
    setIsPolling(true);
    if (showLoadingIndicator) {
      setVerifying(true);
    }
    
    let attempts = 0;
    const maxAttempts = 12; // Poll for up to 24 seconds
    const interval = 2000; // 2 seconds
    
    const runPoll = async () => {
      if (!isMounted.current) {
        setIsPolling(false);
        return;
      }
      try {
        const quote = await getQuote(quoteId);
        if (!isMounted.current) {
          setIsPolling(false);
          return;
        }
        if (quote && (quote.status === 'accepted' || quote.status === 'paid' || (quote.jobId && quote.jobStatus && quote.jobStatus !== 'awaiting_payment'))) {
          HapticFeedback.success();
          setVerifying(false);
          setIsPolling(false);
          setCurrentStep(2);
          return;
        }
      } catch (e) {
        console.error('Polling payment status error:', e);
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        if (isMounted.current) {
          setTimeout(runPoll, interval);
        } else {
          setIsPolling(false);
        }
      } else {
        if (isMounted.current) {
          setVerifying(false);
          setIsPolling(false);
          if (showLoadingIndicator) {
            Alert.alert(
              'Verification Timeout',
              'We could not automatically confirm your payment status yet. If the money has been deducted, your job status will update shortly. You can also manually check status using the "Verify Payment Status" button.',
              [{ text: 'OK' }]
            );
          }
        } else {
          setIsPolling(false);
        }
      }
    };

    setTimeout(runPoll, 1000); // start after 1 second
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && currentStep === 0) {
        // Start polling silently when returning to the app
        startPollingPaymentStatus(false);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [currentStep, quoteId]);


  const handleApplePay = async () => {
    if (paying || payingRef.current) return;
    if (paymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Payment amount must be greater than $0.');
      return;
    }
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple Pay', 'Apple Pay is only available on iOS devices.');
      return;
    }
    try {
      payingRef.current = true;
      setPaying(true);
      let currentClientSecret = clientSecret;
      if (!currentClientSecret) {
        const response = await createPaymentIntent(quoteId, milestoneId);
        if (!response?.clientSecret) {
          Alert.alert('Payment Error', 'Could not initialize Apple Pay session.');
          return;
        }
        currentClientSecret = response.clientSecret;
        setClientSecret(currentClientSecret);
        if (response.amount !== undefined) {
          setPaymentAmount(response.amount);
        }
      }

      const { paymentIntent, error } = await confirmPlatformPayPayment(
        currentClientSecret,
        {
          applePay: {
            cartItems: [
              {
                label: quoteDescription || 'Project Payment',
                amount: String((paymentAmount / 100).toFixed(2)),
                paymentType: PlatformPay.PaymentType.Immediate,
              },
            ],
            merchantCountryCode: 'US',
            currencyCode: 'USD',
          },
        }
      );

      if (error) {
        HapticFeedback.error();
        Alert.alert('Payment Failed', error.message || 'Apple Pay could not be completed.');
      } else if (paymentIntent?.status?.toLowerCase() === 'succeeded') {
        startPollingPaymentStatus(true);
      } else {
        HapticFeedback.error();
        Alert.alert('Payment Status', `Your payment is in status: ${paymentIntent?.status}. Please contact support or complete verification.`);
      }
    } catch (err: any) {
      HapticFeedback.error();
      Alert.alert('Error', err?.message || 'Apple Pay failed to initialize.');
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const handlePayment = async () => {
    if (paying || payingRef.current) return;
    if (paymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Payment amount must be greater than $0.');
      return;
    }
    try {
      payingRef.current = true;
      setPaying(true);
      let currentClientSecret = clientSecret;
      if (!currentClientSecret) {
        const response = await createPaymentIntent(quoteId, milestoneId);
        if (!response?.clientSecret) {
          Alert.alert('Payment Error', 'Could not initialize secure payment session.');
          return;
        }
        currentClientSecret = response.clientSecret;
        setClientSecret(currentClientSecret);
        if (response.amount !== undefined) {
          setPaymentAmount(response.amount);
        }
      }
      
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: currentClientSecret,
        merchantDisplayName: 'Ratedeed',
        applePay: {
          merchantCountryCode: 'US',
        },
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: __DEV__,
        },
        defaultBillingDetails: {
          // Pre-filled billing details can go here
        }
      });

      if (error) {
        HapticFeedback.error();
        Alert.alert('Stripe Error', error.message || 'Failed to initialize payment sheet.');
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          HapticFeedback.error();
          Alert.alert('Payment Failed', presentError.message);
        }
      } else {
        startPollingPaymentStatus(true);
      }
    } catch (err: any) {
      HapticFeedback.error();
      Alert.alert('Error', err?.message || 'Failed to initiate secure payment. Please try again.');
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  const verifyPaymentStatus = async (silent?: boolean) => {
    const isSilent = silent === true;
    if (paying) return;
    try {
      setPaying(true);
      const quote = await getQuote(quoteId);
      if (quote && (quote.status === 'accepted' || quote.status === 'paid' || (quote.jobId && quote.jobStatus && quote.jobStatus !== 'awaiting_payment'))) {
        setCurrentStep(2);
      } else if (!isSilent) {
        Alert.alert('Payment Not Confirmed', 'We could not confirm your payment yet. If you just paid, please wait a moment and try again.');
      }
    } catch (e) {
      if (!isSilent) {
        Alert.alert('Error', 'Could not verify payment status.');
      }
    } finally {
      setPaying(false);
    }
  };

  if (verifying) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#09090B' : '#ffffff', padding: 24 }}>
        <BouncingDotsLoader size="large" color="#4F46E5" />
        <Text style={{ marginTop: 16, color: isDark ? '#ffffff' : '#171717', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>Confirming Payment...</Text>
        <Text style={{ marginTop: 8, color: isDark ? '#a3a3a3' : '#737373', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Please wait while we verify your transaction status. This should only take a few seconds.
        </Text>
      </View>
    );
  }

  if (loadingPaymentIntent) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#09090B' : '#ffffff' }}>
        <BouncingDotsLoader size="large" color="#4F46E5" />
        <Text style={{ marginTop: 12, color: isDark ? '#a3a3a3' : '#737373', fontSize: 14, fontWeight: '500' }}>Initializing secure payment...</Text>
      </View>
    );
  }

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
        {currentStep === 0 && (() => {
          const baseAmount = (route.params?.totalAmount || 0) * 100;
          const processingFee = Math.max(0, paymentAmount - baseAmount);

          return (
            <View style={{ gap: 12 }}>
              <View style={{ backgroundColor: isDark ? '#171717' : 'white', borderRadius: 16, borderWidth: 1, borderColor: isDark ? '#262626' : '#e5e5e5', padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717', borderBottomWidth: 1, borderBottomColor: isDark ? '#262626' : '#f5f5f5', paddingBottom: 8 }}>Payment Breakdown</Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: isDark ? '#a3a3a3' : '#737373' }}>
                    {route.params?.isMilestone ? 'Milestone Amount' : 'Base Amount'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#ffffff' : '#171717' }}>
                    ${(baseAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: isDark ? '#a3a3a3' : '#737373' }}>Stripe Processing Fee</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#ffffff' : '#171717' }}>
                      ${(processingFee / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: isDark ? '#737373' : '#a3a3a3', lineHeight: 14 }}>
                    Charged by Stripe payment processor. Ratedeed does not keep this fee.
                  </Text>
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: isDark ? '#262626' : '#e5e5e5', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>{contractorName}</Text>
                    <Text style={{ fontSize: 11, color: isDark ? '#a3a3a3' : '#737373' }}>Service Fee Included</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>${(paymentAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {route.params?.isMilestone && (
                <View style={{ backgroundColor: isDark ? '#1e1b4b' : '#f5f3ff', borderWidth: 1, borderColor: isDark ? '#312e81' : '#ddd6fe', borderRadius: 16, padding: 16 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5 }}>Milestone Escrow Payment</Text>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDark ? '#ffffff' : '#1f2937', marginTop: 4 }}>
                    {quoteDescription}
                  </Text>
                </View>
              )}

              <View style={{ backgroundColor: '#171717', borderRadius: 16, padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 1 }}>Total Amount</Text>
                <Text style={{ fontSize: 30, fontWeight: 'bold', color: 'white', marginTop: 4 }}>${(paymentAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
                <PlatformPayButton
                  type={PlatformPay.ButtonType.Pay}
                  onPress={handleApplePay}
                  style={styles.applePayBtn}
                />
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
                disabled={paying || paymentAmount <= 0}
                style={{
                  width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16,
                  backgroundColor: (paying || paymentAmount <= 0) ? '#d4d4d4' : '#4F46E5'
                }}
              >
                {paying ? (
                  <BouncingDotsLoader size="small" color="#fff" />
                ) : (
                  <>
                    <FontAwesome5 name="lock" size={14} color="#fff" />
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>Secure Checkout</Text>
                  </>
                )}
              </Pressable>
              
              <Pressable
                onPress={() => startPollingPaymentStatus(true)}
                disabled={paying || isPolling}
                style={{
                  width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12,
                  backgroundColor: (paying || isPolling) ? '#f5f5f5' : '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7'
                }}
              >
                {paying || isPolling ? (
                  <BouncingDotsLoader size="small" color={isDark ? '#a3a3a3' : '#737373'} />
                ) : (
                  <FontAwesome5 name="sync" size={12} color={isDark ? '#a3a3a3' : '#737373'} />
                )}
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#a3a3a3' : '#52525b' }}>
                  {paying || isPolling ? 'Verifying...' : 'Verify Payment Status'}
                </Text>
              </Pressable>
              
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <FontAwesome5 name="stripe" size={32} color="#6366F1" />
                  <Text style={{ fontSize: 10, color: '#a3a3a3', fontWeight: '500' }}>PCI Compliant Checkout</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Step 2: Confirmed */}
        {currentStep === 2 && (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <View style={{ width: 80, height: 80, backgroundColor: '#ecfdf5', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <FontAwesome5 name="check" size={32} color="#10b981" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>Payment Confirmed!</Text>
            <Text style={{ fontSize: 30, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717', marginTop: 8 }}>${(paymentAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
    height: 48,
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
