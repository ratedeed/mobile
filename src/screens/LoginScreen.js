import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { login } from '../api/auth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
import { Spacing, Colors, Radii, Shadows } from '../constants/designTokens';
import Typography from '../components/common/Typography';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await login(email, password);
      Alert.alert('Success', 'Logged in successfully!');
      // You might want to store the user data/token here (e.g., using AsyncStorage)
      navigation.navigate('Main'); // Navigate to the Main tab navigator
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'An error occurred. Please try again.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Welcome Back" />
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.formContainer}>
          <Typography variant="h3" style={styles.title}>Sign In</Typography>
          <Typography variant="subtitle1" style={styles.subtitle}>
            Access your RateDeed account to manage your projects.
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
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.inputField}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
          />

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotPasswordPrompt}>
            <Typography variant="body" style={styles.linkText}>
              Forgot your password? <Typography variant="button" style={styles.linkLink}>Reset Password</Typography>
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerPrompt}>
            <Typography variant="body" style={styles.linkText}>
              Don't have an account? <Typography variant="button" style={styles.linkLink}>Sign Up</Typography>
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ContractorSignup')} style={styles.contractorPrompt}>
            <Typography variant="body" style={styles.linkText}>
              Are you a contractor? <Typography variant="button" style={styles.linkLink}>Sign Up as a Contractor</Typography>
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
  loginButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  forgotPasswordPrompt: {
    marginTop: Spacing.md,
    padding: Spacing.xs,
  },
  registerPrompt: {
    marginTop: Spacing.sm,
    padding: Spacing.xs,
  },
  contractorPrompt: {
    marginTop: Spacing.sm,
    padding: Spacing.xs,
  },
  linkText: {
    color: Colors.neutral700,
  },
  linkLink: {
    color: Colors.primary500,
    fontWeight: '700',
  },
});

export default LoginScreen;