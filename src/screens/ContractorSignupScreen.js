import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { contractorSignup } from '../api/auth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import Typography from '../components/common/Typography';

const ContractorSignupScreen = () => {
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const handleContractorSignup = async () => {
    if (!businessName || !contactPerson || !email || !phone || !password || !confirmPassword || !category) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await contractorSignup(businessName, contactPerson, email, phone, password, zipCode, category);
      Alert.alert('Success', 'Contractor registration successful! Please sign in.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Registration Failed', error.message || 'An error occurred during registration.');
      console.error('Contractor signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Contractor Sign Up" showBackButton />
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.formContainer}>
          <Typography variant="h3" style={styles.title}>Join RateDeed as a Contractor</Typography>
          <Typography variant="subtitle1" style={styles.subtitle}>
            Showcase your expertise and connect with clients seeking quality services.
          </Typography>
          
          <Input
            label="Business Name"
            placeholder="Enter your business name"
            value={businessName}
            onChangeText={setBusinessName}
            style={styles.inputField}
          />
          <Input
            label="Contact Person"
            placeholder="Enter contact person's name"
            value={contactPerson}
            onChangeText={setContactPerson}
            style={styles.inputField}
          />
          <Input
            label="Email"
            placeholder="Enter your business email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            style={styles.inputField}
          />
          <Input
            label="Phone Number"
            placeholder="Enter business phone number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            style={styles.inputField}
          />
          <Input
            label="Category"
            placeholder="e.g., Plumber, Electrician, Painter"
            value={category}
            onChangeText={setCategory}
            style={styles.inputField}
          />
          <Input
            label="Zip Code (Optional)"
            placeholder="Enter your business zip code"
            keyboardType="numeric"
            value={zipCode}
            onChangeText={setZipCode}
            style={styles.inputField}
          />
          <Input
            label="Password"
            placeholder="Create a strong password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.inputField}
          />
          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.inputField}
          />
          
          <Button
            title="Sign Up as Contractor"
            onPress={handleContractorSignup}
            loading={loading}
            style={styles.signupButton}
          />
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginPrompt}>
            <Typography variant="body" style={styles.loginText}>
              Already have an account? <Typography variant="button" style={styles.loginLink}>Sign In</Typography>
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
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
  signupButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  loginPrompt: {
    marginTop: Spacing.md,
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

export default ContractorSignupScreen;