import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { forgotPassword } from '../api/auth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
import { Spacing, Colors, Radii, Shadows } from '../constants/designTokens';
import Typography from '../components/common/Typography';

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      Alert.alert('Success', 'Password reset link sent to your email!');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Reset Failed', error.message || 'Failed to send reset link.');
      console.error('Forgot password error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Forgot Password" showBackButton />
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.formContainer}>
          <Typography variant="h3" style={styles.title}>Reset Your Password</Typography>
          <Typography variant="subtitle1" style={styles.subtitle}>
            Enter your email address below and we'll send you a link to reset your password.
          </Typography>

          <Input
            label="Email"
            placeholder="Enter your email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.inputField}
          />
          <Button
            title="Send Reset Link"
            onPress={handleResetPassword}
            loading={loading}
            style={styles.resetButton}
          />
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backToLoginPrompt}>
            <Typography variant="body" style={styles.backToLoginText}>
              Remembered your password? <Typography variant="button" style={styles.backToLoginLink}>Back to Sign In</Typography>
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  formContainer: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    ...Shadows.md,
    alignItems: 'center',
  },
  title: {
    marginBottom: Spacing.xs,
    color: Colors.neutral900,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: Spacing.xl,
    color: Colors.neutral600,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  inputField: {
    marginBottom: Spacing.md,
  },
  resetButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  backToLoginPrompt: {
    marginTop: Spacing.md,
    padding: Spacing.xs,
  },
  backToLoginText: {
    color: Colors.neutral700,
  },
  backToLoginLink: {
    color: Colors.primary500,
    fontWeight: '700',
  },
});

export default ForgotPasswordScreen;