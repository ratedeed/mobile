import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/common/Header';
import { Colors, Spacing, Radii } from '../constants/designTokens';

const STEP_LABELS = ['Payment', 'Review', 'Processing', 'Confirmed'];

export default function PaymentFlowScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const quoteId = route.params?.quoteId || '1';

  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Auto-advance processing to confirmed
  useEffect(() => {
    if (currentStep === 2) {
      const timer = setTimeout(() => {
        setCurrentStep(3);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const handleCardSubmit = () => {
    // Basic validation skip for demo
    setCurrentStep(1);
  };

  const handlePayNow = () => {
    setCurrentStep(2);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#09090B" />
      </View>
    );
  }

  const quoteTotal = 450;
  const contractorName = "Acme Plumbing";

  return (
    <View style={styles.container}>
      <Header title={currentStep === 3 ? 'Payment Complete' : 'Payment'} showBackButton={currentStep <= 1} />

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        {STEP_LABELS.map((label, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <View key={label} style={styles.stepContainer}>
              <View style={[styles.stepCircle, isDone ? styles.stepCircleDone : isActive ? styles.stepCircleActive : styles.stepCircleInactive]}>
                {isDone ? (
                  <FontAwesome5 name="check" size={12} color="white" />
                ) : (
                  <Text style={[styles.stepNumber, isActive ? styles.stepNumberActive : styles.stepNumberInactive]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, isActive ? styles.stepLabelActive : styles.stepLabelInactive]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView style={styles.scrollContainer}>
        {currentStep === 0 && (
          <View style={styles.formContainer}>
            <View style={styles.cardContainer}>
              <View style={styles.cardHeader}>
                <FontAwesome5 name="credit-card" size={18} color="#09090B" style={{ marginRight: 8 }} />
                <Text style={styles.cardTitle}>Payment Method</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Card Number</Text>
                <TextInput
                  value={cardNumber}
                  onChangeText={setCardNumber}
                  placeholder="1234 5678 9012 3456"
                  keyboardType="numeric"
                  style={styles.inputField}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.flex1}>
                  <Text style={styles.inputLabel}>Expiry</Text>
                  <TextInput
                    value={expiry}
                    onChangeText={setExpiry}
                    placeholder="MM/YY"
                    keyboardType="numeric"
                    style={styles.inputField}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    value={cvv}
                    onChangeText={setCvv}
                    placeholder="•••"
                    keyboardType="numeric"
                    secureTextEntry
                    style={styles.inputField}
                  />
                </View>
              </View>

              <View style={styles.inputGroupBottom}>
                <Text style={styles.inputLabel}>Cardholder Name</Text>
                <TextInput
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="John Doe"
                  style={styles.inputField}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleCardSubmit}
              style={styles.continueButton}
            >
              <Text style={styles.buttonTextRight}>Continue</Text>
              <FontAwesome5 name="chevron-right" size={14} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {currentStep === 1 && (
          <View style={styles.formContainer}>
            <View style={styles.cardContainerBottom}>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={styles.contractorName}>{contractorName}</Text>
                  <Text style={styles.serviceFeeText}>Service Fee Included</Text>
                </View>
                <Text style={styles.quoteTotal}>${quoteTotal.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.totalAmountContainer}>
              <Text style={styles.totalAmountLabel}>Total Amount</Text>
              <Text style={styles.totalAmountValue}>${quoteTotal.toLocaleString()}</Text>
            </View>

            <View style={styles.escrowContainer}>
              <FontAwesome5 name="shield-alt" size={18} color="#059669" style={{ marginTop: 2, marginRight: 12 }} />
              <View style={styles.flex1}>
                <Text style={styles.escrowTitle}>Escrow Protection</Text>
                <Text style={styles.escrowDesc}>Your payment will be held in escrow. Funds are only released to the contractor when you confirm the job is complete.</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handlePayNow}
              style={styles.payButton}
            >
              <FontAwesome5 name="lock" size={14} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.payButtonText}>Pay ${quoteTotal.toLocaleString()}</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentStep === 2 && (
          <View style={styles.processingContainer}>
            <View style={styles.loadingCircle}>
              <ActivityIndicator size="large" color="#A3A3A3" />
            </View>
            <Text style={styles.statusTitle}>Processing your payment...</Text>
            <Text style={styles.statusDesc}>
              Please don't close this page. Your payment is being processed securely.
            </Text>
          </View>
        )}

        {currentStep === 3 && (
          <View style={styles.confirmedContainer}>
            <View style={styles.successCircle}>
              <FontAwesome5 name="check" size={32} color="#10B981" />
            </View>
            <Text style={styles.statusTitle}>Payment Confirmed!</Text>
            <Text style={styles.confirmedAmount}>${quoteTotal.toLocaleString()}</Text>
            <Text style={styles.confirmedTo}>paid to {contractorName}</Text>

            <View style={styles.escrowContainerConfirmed}>
              <FontAwesome5 name="shield-alt" size={18} color="#059669" style={{ marginTop: 2, marginRight: 12 }} />
              <View style={styles.flex1}>
                <Text style={styles.escrowTitle}>Funds Held in Escrow</Text>
                <Text style={styles.escrowDesc}>Your payment is securely held in escrow and will be released to the contractor once you confirm the job is complete.</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('ActiveJobs')}
              style={styles.viewJobsButton}
            >
              <FontAwesome5 name="briefcase" size={14} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>View My Jobs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Home')}
              style={styles.backHomeButton}
            >
              <Text style={styles.backHomeText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.neutral50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.neutral50,
  },
  progressBarContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: Colors.success500,
  },
  stepCircleActive: {
    backgroundColor: Colors.neutral900,
  },
  stepCircleInactive: {
    backgroundColor: Colors.neutral100,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepNumberActive: {
    color: Colors.neutral50,
  },
  stepNumberInactive: {
    color: Colors.neutral400,
  },
  stepLabel: {
    fontSize: 9,
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: Colors.neutral900,
  },
  stepLabelInactive: {
    color: Colors.neutral400,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  formContainer: {
    paddingTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  cardContainer: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral200,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutral700,
    marginBottom: 6,
  },
  inputField: {
    width: '100%',
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.neutral200,
    fontSize: 14,
    color: Colors.neutral900,
    backgroundColor: Colors.neutral50,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  inputGroupBottom: {
    marginBottom: Spacing.md,
  },
  continueButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.xl,
    backgroundColor: Colors.primary500,
    marginTop: Spacing.md,
  },
  buttonTextRight: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.neutral50,
    marginRight: Spacing.xs,
  },
  cardContainerBottom: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral200,
    marginBottom: Spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contractorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  serviceFeeText: {
    fontSize: 12,
    color: Colors.neutral500,
  },
  quoteTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  totalAmountContainer: {
    backgroundColor: Colors.neutral900,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  totalAmountLabel: {
    fontSize: 12,
    color: Colors.neutral400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  totalAmountValue: {
    fontSize: 30,
    fontWeight: 'bold',
    color: Colors.neutral50,
  },
  escrowContainer: {
    backgroundColor: '#ecfdf5',
    borderRadius: Radii.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#d1fae5',
    marginBottom: Spacing.lg,
  },
  escrowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
  },
  escrowDesc: {
    fontSize: 12,
    color: '#047857',
    marginTop: Spacing.xs,
  },
  payButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.xl,
    backgroundColor: Colors.primary500,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.neutral50,
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.neutral900,
    marginBottom: Spacing.xs,
  },
  statusDesc: {
    fontSize: 14,
    color: Colors.neutral500,
    textAlign: 'center',
    marginHorizontal: 40,
  },
  confirmedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  confirmedAmount: {
    fontSize: 30,
    fontWeight: 'bold',
    color: Colors.neutral900,
    marginBottom: Spacing.xs,
  },
  confirmedTo: {
    fontSize: 14,
    color: Colors.neutral500,
    marginBottom: 32,
  },
  escrowContainerConfirmed: {
    backgroundColor: '#ecfdf5',
    borderRadius: Radii.xl,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#d1fae5',
    marginBottom: 32,
    width: '100%',
  },
  viewJobsButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.xl,
    backgroundColor: Colors.primary500,
    marginBottom: Spacing.sm,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.neutral50,
  },
  backHomeButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radii.xl,
  },
  backHomeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral500,
  },
});
