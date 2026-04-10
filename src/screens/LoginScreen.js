import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { backendLoginFirebase, syncEmailVerificationStatus } from '../api/auth';
import { auth } from '../firebaseConfig';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
import Typography from '../components/common/Typography';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const navigation = useNavigation();
  const { updateBackendToken } = useAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user && !user.emailVerified) {
        setShowVerificationMessage(true);
      } else {
        setShowVerificationMessage(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter both email and password.',
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('LoginScreen: Firebase signInWithEmailAndPassword successful. User UID:', user.uid, 'Email:', user.email);

      await user.reload();
      const reloadedUser = auth.currentUser;
      console.log('LoginScreen: Firebase user reloaded. Current user UID:', reloadedUser?.uid, 'Email:', reloadedUser?.email);

      if (!reloadedUser) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Firebase user not found after reload. Please try again.',
        });
        console.error('LoginScreen: Firebase user is null after reload.');
        return;
      }

      if (!reloadedUser.emailVerified) {
        Toast.show({
          type: 'info',
          text1: 'Verification Required',
          text2: 'Please verify your email address to continue.',
        });
        setShowVerificationMessage(true);
        console.log('LoginScreen: Email not verified. Preventing navigation to Main.');
        return; 
      }

      const idToken = await reloadedUser.getIdToken();
      console.log('LoginScreen: Firebase ID Token generated (first 20 chars):', idToken ? idToken.substring(0, 20) + '...' : 'No');

      let backendResponse;
      try {
        backendResponse = await backendLoginFirebase(idToken, email);
        console.log('LoginScreen: Backend login response:', JSON.stringify(backendResponse, null, 2));

        if (backendResponse && backendResponse.token) {
          await updateBackendToken(backendResponse.token, backendResponse.emailVerified);
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Logged in successfully!',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Login Failed',
            text2: 'Backend authentication failed or no token received. Please try again.',
          });
          console.error('LoginScreen: Backend login did not return a token.');
        }
      } catch (backendError) {
        let errorMessage = 'Failed to connect to backend or backend authentication failed.';
        if (backendError.message) {
          errorMessage = backendError.message;
        }
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: errorMessage,
        });
        console.error('LoginScreen: Error during backend login:', backendError);
      }

    } catch (error) { 
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Your account has been disabled.';
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = 'Invalid email or password.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many login attempts. Please try again later.';
            break;
          default:
            errorMessage = error.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: errorMessage,
      });
      console.error('LoginScreen: Firebase or general login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (auth && auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'Verification email sent! Please check your inbox.',
        });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.message || 'Failed to send verification email.',
        });
        console.error('Resend verification error:', error);
      }
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'User not logged in or auth not initialized.',
      });
    }
  };

  const handleVerifiedCheck = async () => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          const idToken = await auth.currentUser.getIdToken();
          await syncEmailVerificationStatus(idToken, auth.currentUser.email, true);
          Toast.show({
            type: 'success',
            text1: 'Email Verified',
            text2: 'Your email has been successfully verified! You can now log in.',
          });
          setShowVerificationMessage(false);
          const backendResponse = await backendLoginFirebase(idToken, auth.currentUser.email);
          if (backendResponse && backendResponse.token) {
            await updateBackendToken(backendResponse.token, backendResponse.emailVerified); 
          } else {
            Toast.show({
              type: 'error',
              text1: 'Login Failed',
              text2: 'Backend authentication failed after email verification. Please try again.',
            });
          }
        } else {
          Toast.show({
            type: 'info',
            text1: 'Not Verified',
            text2: 'Your email is still not verified. Please check your inbox or resend the email.',
          });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Verification Check Failed',
          text2: error.message || 'Failed to check verification status.',
        });
        console.error('Verification check error:', error);
      }
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No user is currently logged in.',
      });
    }
  };

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Welcome Back" />
      <ScrollView contentContainerClassName="flex-grow justify-center p-4">
        <View style={styles.cardContainer}>
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

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.linkButton}>
            <Typography variant="body" style={styles.mutedText}>
              Forgot your password? <Typography variant="button" style={styles.primaryLinkText}>Reset Password</Typography>
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkButton}>
            <Typography variant="body" style={styles.mutedText}>
              Don't have an account? <Typography variant="button" style={styles.primaryLinkText}>Sign Up</Typography>
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ContractorSignup')} style={styles.linkButton}>
            <Typography variant="body" style={styles.mutedText}>
              Are you a contractor? <Typography variant="button" style={styles.primaryLinkText}>Sign Up as a Contractor</Typography>
            </Typography>
          </TouchableOpacity>
          {showVerificationMessage && (
            <View style={styles.verificationCard}>
              <Typography variant="body" style={styles.verificationText}>
                Your email is not verified. Please check your inbox for a verification link.
              </Typography>
              <Button
                title="Resend Verification Email"
                onPress={handleResendVerification}
                style={styles.resendButton}
              />
              <TouchableOpacity onPress={handleVerifiedCheck} style={styles.linkButton}>
                <Typography variant="button" style={styles.primaryLinkText}>
                  I have verified my email
                </Typography>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default LoginScreen;
