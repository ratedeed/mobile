import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { register } from '../api/auth';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
import Typography from '../components/common/Typography';
import Toast from 'react-native-toast-message';

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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields.',
      });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Passwords do not match.',
      });
      return;
    }

    setLoading(true);
    let userCreated = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userCreated = userCredential.user;
      console.log('RegisterScreen: Firebase createUserWithEmailAndPassword successful. User UID:', userCreated.uid, 'Email:', userCreated.email);
      await sendEmailVerification(userCreated);
      console.log('RegisterScreen: Verification email sent.');

      console.log('RegisterScreen: Checking AsyncStorage availability before removeItem:', typeof AsyncStorage);
      await AsyncStorage.removeItem('userInfo');
      console.log('RegisterScreen: Cleared any existing userInfo from AsyncStorage before backend registration.');

      await register(firstName, lastName, email, password, zipCode, userCreated.uid); 

      await auth.signOut(); 
      console.log('RegisterScreen: Firebase user signed out after registration.');

      Toast.show({
        type: 'success',
        text1: 'Registration Successful',
        text2: 'A verification email has been sent to your email address. Please verify your email before logging in.',
      });
      navigation.navigate('Login');
    } catch (error) {
      if (userCreated) {
        try {
           await deleteUser(userCreated);
           console.log('RegisterScreen: Rollback successful. Deleted orphaned Firebase user.');
        } catch (rollbackError) {
           console.error('RegisterScreen: Failed to rollback Firebase user:', rollbackError);
        }
      }
      let errorMessage = 'An error occurred during registration.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'That email address is already in use!';
            break;
          case 'auth/invalid-email':
            errorMessage = 'That email address is invalid!';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please enable them in the Firebase console.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak.';
            break;
          default:
            errorMessage = error.message;
            break;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: errorMessage,
      });
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Create Account" showBackButton />
      <ScrollView contentContainerClassName="flex-grow justify-center p-4">
        <View style={styles.cardContainer}>
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

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
            <Typography variant="body" style={styles.mutedText}>
              Already have an account? <Typography variant="button" style={styles.primaryLinkText}>Login</Typography>
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ContractorSignup')} style={styles.linkButton}>
            <Typography variant="body" style={styles.mutedText}>
              Are you a contractor? <Typography variant="button" style={styles.primaryLinkText}>Sign Up as a Contractor</Typography>
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default RegisterScreen;