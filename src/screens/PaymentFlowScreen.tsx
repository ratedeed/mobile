import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';

const STEP_LABELS = ['Payment', 'Review', 'Processing', 'Confirmed'];

export default function PaymentFlowScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const quoteId = route.params?.quoteId || '1';

  const [currentStep, setCurrentStep] = useState(0);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');

  useEffect(() => {
    if (currentStep === 2) {
      const timer = setTimeout(() => setCurrentStep(3), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const quoteTotal = 450;
  const contractorName = 'Acme Plumbing';

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-200">
        {currentStep <= 1 && (
          <Pressable onPress={() => currentStep === 0 ? navigation.goBack() : setCurrentStep(0)} className="w-8 h-8 items-center justify-center">
            <FontAwesome5 name="chevron-left" size={18} color="#171717" />
          </Pressable>
        )}
        <Text className="text-sm font-bold text-neutral-900 flex-1 text-center">
          {currentStep === 3 ? 'Payment Complete' : 'Payment'}
        </Text>
        <View className="w-8" />
      </View>

      {/* Progress Steps */}
      <View className="flex-row items-center justify-between px-6 py-4">
        {STEP_LABELS.map((label, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <View key={label} className="flex-1 items-center">
              <View className={`w-7 h-7 rounded-full items-center justify-center ${
                isDone ? 'bg-emerald-500' : isActive ? 'bg-neutral-900' : 'bg-neutral-100'
              }`}>
                {isDone ? (
                  <FontAwesome5 name="check" size={10} color="#fff" />
                ) : (
                  <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-neutral-400'}`}>{i + 1}</Text>
                )}
              </View>
              <Text className={`text-[9px] mt-1 font-medium ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>{label}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Step 0: Payment Method */}
        {currentStep === 0 && (
          <View style={{ gap: 16 }}>
            <View className="bg-white rounded-2xl border border-neutral-200 p-4">
              <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
                <FontAwesome5 name="credit-card" size={16} color="#171717" />
                <Text className="text-base font-bold text-neutral-900">Payment Method</Text>
              </View>
              <Text className="text-xs font-semibold text-neutral-500 mb-1">Card Number</Text>
              <TextInput
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor="#a3a3a3"
                keyboardType="numeric"
                className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
              />
              <View className="flex-row" style={{ gap: 12 }}>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-neutral-500 mb-1">Expiry</Text>
                  <TextInput
                    value={expiry}
                    onChangeText={setExpiry}
                    placeholder="MM/YY"
                    placeholderTextColor="#a3a3a3"
                    keyboardType="numeric"
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-neutral-500 mb-1">CVV</Text>
                  <TextInput
                    value={cvv}
                    onChangeText={setCvv}
                    placeholder="123"
                    placeholderTextColor="#a3a3a3"
                    keyboardType="numeric"
                    secureTextEntry
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                  />
                </View>
              </View>
              <Text className="text-xs font-semibold text-neutral-500 mb-1 mt-3">Cardholder Name</Text>
              <TextInput
                value={cardName}
                onChangeText={setCardName}
                placeholder="John Doe"
                placeholderTextColor="#a3a3a3"
                className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
              />
            </View>
            <Pressable
              onPress={() => setCurrentStep(1)}
              className="w-full py-3.5 bg-indigo-600 rounded-xl items-center flex-row justify-center"
              style={{ gap: 8 }}
            >
              <Text className="text-sm font-semibold text-white">Continue</Text>
              <FontAwesome5 name="chevron-right" size={12} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Step 1: Review */}
        {currentStep === 1 && (
          <View style={{ gap: 12 }}>
            <View className="bg-white rounded-2xl border border-neutral-200 p-4">
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-sm font-bold text-neutral-900">{contractorName}</Text>
                  <Text className="text-xs text-neutral-500">Service Fee Included</Text>
                </View>
                <Text className="text-lg font-bold text-neutral-900">${quoteTotal.toLocaleString()}</Text>
              </View>
            </View>

            <View className="bg-neutral-900 rounded-2xl p-6 items-center">
              <Text className="text-xs text-neutral-400 uppercase tracking-widest">Total Amount</Text>
              <Text className="text-3xl font-bold text-white mt-1">${quoteTotal.toLocaleString()}</Text>
            </View>

            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex-row items-start" style={{ gap: 12 }}>
              <FontAwesome5 name="shield-alt" size={18} color="#059669" style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-emerald-800">Escrow Protection</Text>
                <Text className="text-xs text-emerald-700 mt-1 leading-4">
                  Your payment will be held in escrow. Funds are only released when you confirm the job is complete.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setCurrentStep(2)}
              className="w-full py-3.5 bg-indigo-600 rounded-xl items-center flex-row justify-center"
              style={{ gap: 8 }}
            >
              <FontAwesome5 name="lock" size={14} color="#fff" />
              <Text className="text-base font-bold text-white">Pay ${quoteTotal.toLocaleString()}</Text>
            </Pressable>
          </View>
        )}

        {/* Step 2: Processing */}
        {currentStep === 2 && (
          <View className="items-center justify-center py-20">
            <View className="w-20 h-20 bg-neutral-100 rounded-full items-center justify-center mb-6">
              <ActivityIndicator size="large" color="#a3a3a3" />
            </View>
            <Text className="text-xl font-bold text-neutral-900">Processing your payment...</Text>
            <Text className="text-sm text-neutral-500 text-center mt-2 px-10">
              Please don't close this page. Your payment is being processed securely.
            </Text>
          </View>
        )}

        {/* Step 3: Confirmed */}
        {currentStep === 3 && (
          <View className="items-center py-8">
            <View className="w-20 h-20 bg-emerald-50 rounded-full items-center justify-center mb-6">
              <FontAwesome5 name="check" size={32} color="#10b981" />
            </View>
            <Text className="text-xl font-bold text-neutral-900">Payment Confirmed!</Text>
            <Text className="text-3xl font-bold text-neutral-900 mt-2">${quoteTotal.toLocaleString()}</Text>
            <Text className="text-sm text-neutral-500">paid to {contractorName}</Text>

            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex-row items-start mt-8 w-full" style={{ gap: 12 }}>
              <FontAwesome5 name="shield-alt" size={18} color="#059669" style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-emerald-800">Funds Held in Escrow</Text>
                <Text className="text-xs text-emerald-700 mt-1 leading-4">
                  Your payment is securely held and will be released once you confirm the job is complete.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('ActiveJobs')}
              className="w-full py-3.5 bg-indigo-600 rounded-xl items-center flex-row justify-center mt-6"
              style={{ gap: 8 }}
            >
              <FontAwesome5 name="briefcase" size={14} color="#fff" />
              <Text className="text-sm font-semibold text-white">View My Jobs</Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Home')} className="mt-3 py-2">
              <Text className="text-sm font-medium text-neutral-500">Back to Home</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
