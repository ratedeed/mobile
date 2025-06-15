import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { register } from '../api/auth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
import { Spacing, Colors, Radii, Shadows } from '../constants/designTokens';
import Typography from '../components/common/Typography';

const RegisterScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await register(firstName, lastName, email, password, zipCode);
      Alert.alert('Success', 'Registration successful! Please sign in.');
      navigation.navigate('Login'); // After registration, typically navigate to login
    } catch (error) {
      Alert.alert('Registration Failed', error.message || 'An error occurred during registration.');
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Create Account" showBackButton />
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.formContainer}>
          <Typography variant="h3" style={styles.title}>Join RateDeed</Typography>
          <Typography variant="subtitle1" style={styles.subtitle}>
            Sign up to connect with top contractors and manage your projects.
          </Typography>

          <Input
            label="First Name"
            placeholder="Enter your first name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            style={styles.inputField}
          />
          <Input
            label="Last Name"
            placeholder="Enter your last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            style={styles.inputField}
          />
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
            placeholder="Create a strong password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.inputField}
          />
          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={styles.inputField}
          />
          <Input
            label="Zip Code (Optional)"
            placeholder="Enter your zip code"
            value={zipCode}
            onChangeText={setZipCode}
            keyboardType="numeric"
            style={styles.inputField}
          />

          <Button
            title="Register"
            onPress={handleRegister}
            loading={loading}
            style={styles.registerButton}
          />

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginPrompt}>
            <Typography variant="body" style={styles.loginText}>
              Already have an account? <Typography variant="button" style={styles.loginLink}>Login</Typography>
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ContractorSignup')} style={styles.contractorPrompt}>
            <Typography variant="body" style={styles.loginText}>
              Are you a contractor? <Typography variant="button" style={styles.loginLink}>Sign Up as a Contractor</Typography>
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
    backgroundColor: Colors.neutral100, // Light background for the screen
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
    ...Shadows.md, // Apply a noticeable shadow to the form card
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
    marginBottom: Spacing.md, // Spacing between inputs
  },
  registerButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  loginPrompt: {
    marginTop: Spacing.md,
    padding: Spacing.xs, // Make touch area larger
  },
  contractorPrompt: {
    marginTop: Spacing.sm,
    padding: Spacing.xs,
  },
  loginText: {
    color: Colors.neutral700,
  },
  loginLink: {
    color: Colors.primary500,
    fontWeight: '700',
  },
});

export default RegisterScreen;