import React, { useState } from 'react';
import { View, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { contractorSignup } from '../api/auth';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
console.log('ContractorSignupScreen: auth imported.');
console.log('ContractorSignupScreen: Firebase Auth module loaded.');
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
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
    let userCreated = null;
    try {
      console.log('ContractorSignupScreen: Attempting to create user with email and password.');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userCreated = userCredential.user;
      console.log('ContractorSignupScreen: User created, attempting to send email verification.');
      await sendEmailVerification(userCreated);

      const data = await contractorSignup(businessName, contactPerson, email, phone, password, zipCode, category);

      await auth.signOut();

      Alert.alert(
        'Success',
        'Contractor registration successful! A verification email has been sent to your email address. Please verify your email before signing in.'
      );
      navigation.navigate('Login');
    } catch (error) {
      if (userCreated) {
        try {
           await deleteUser(userCreated);
           console.log('ContractorSignupScreen: Rollback successful. Deleted orphaned Firebase user.');
        } catch (rollbackError) {
           console.error('ContractorSignupScreen: Failed to rollback Firebase user:', rollbackError);
        }
      }
      let errorMessage = 'An error occurred during registration.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'The email address is already in use by another account.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak.';
            break;
          default:
            errorMessage = error.message;
            break;
        }
      }
      Alert.alert('Registration Failed', errorMessage);
      console.error('Contractor signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Contractor Sign Up" showBackButton />
      <ScrollView contentContainerClassName="flex-grow justify-center p-4">
        <View style={styles.cardContainer}>
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
            style={styles.registerButton}
          />
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
            <Typography variant="body" style={styles.mutedText}>
              Already have an account? <Typography variant="button" style={styles.primaryLinkText}>Sign In</Typography>
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default ContractorSignupScreen;