import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createCheckoutSession } from '../api';
import { FontAwesome5 } from '@expo/vector-icons';

const STEP_LABELS = ['Review', 'Payment', 'Confirmed'];

export default function PaymentFlowScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const quoteId = route.params?.quoteId || '1';

  const [currentStep, setCurrentStep] = useState(0);
  const [paying, setPaying] = useState(false);

  // Mock data - In a real app, you'd fetch this from the quoteId
  const quoteTotal = 450;
  const contractorName = 'Acme Plumbing';

  const handlePayment = async () => {
    try {
      setPaying(true);
      const { url } = await createCheckoutSession(quoteId);
      
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        toolbarColor: '#4F46E5',
        controlsColor: '#FFFFFF',
      });
      
      setCurrentStep(2);
    } catch (err) {
      // console.error(err);
      Alert.alert('Error', 'Failed to initiate secure payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' }}>
        {currentStep === 0 && (
          <Pressable onPress={() => navigation.goBack()} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesome5 name="chevron-left" size={18} color="#171717" />
          </Pressable>
        )}
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#171717', flex: 1, textAlign: 'center' }}>
          {currentStep === 2 ? 'Payment Complete' : 'Secure Payment'}
        </Text>
        <View style={{ width: 32 }} />
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
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#171717' }}>{contractorName}</Text>
                  <Text style={{ fontSize: 12, color: '#737373' }}>Service Fee Included</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#171717' }}>${quoteTotal.toLocaleString()}</Text>
              </View>
            </View>

            <View style={{ backgroundColor: '#171717', borderRadius: 16, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 1 }}>Total Amount</Text>
              <Text style={{ fontSize: 30, fontWeight: 'bold', color: 'white', marginTop: 4 }}>${quoteTotal.toLocaleString()}</Text>
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
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#171717' }}>Payment Confirmed!</Text>
            <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#171717', marginTop: 8 }}>${quoteTotal.toLocaleString()}</Text>
            <Text style={{ fontSize: 14, color: '#737373' }}>paid to {contractorName}</Text>

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

            <Pressable onPress={() => navigation.navigate('Home')} style={{ marginTop: 12, paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#737373' }}>Back to Home</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
