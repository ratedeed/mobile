import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { backendLoginFirebase, syncEmailVerificationStatus } from '../api/auth';
import { auth } from '../firebaseConfig';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Header from '../components/common/Header';
import { Spacing, Colors, Radii, Shadows } from '../constants/designTokens';
import Typography from '../components/common/Typography';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext'; // Import useAuth

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const navigation = useNavigation();
  const { updateBackendToken } = useAuth(); // Get updateBackendToken from AuthContext

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
        return; // Prevent navigation if email is not verified
      }

      // If email is verified, proceed with backend login
      const idToken = await reloadedUser.getIdToken();
      console.log('LoginScreen: Firebase ID Token generated (first 20 chars):', idToken ? idToken.substring(0, 20) + '...' : 'No');

      let backendResponse;
      try {
        backendResponse = await backendLoginFirebase(idToken, email);
        console.log('LoginScreen: Backend login response:', JSON.stringify(backendResponse, null, 2));

        if (backendResponse && backendResponse.token) {
          await updateBackendToken(backendResponse.token, backendResponse.emailVerified); // Update backend token and emailVerified in AuthContext
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Logged in successfully!',
          });
          // Navigation to Main is handled by AuthContext's isAuthenticated state change
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

    } catch (error) { // Catch all errors from Firebase signInWithEmailAndPassword and subsequent operations
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
          // After successful verification and sync, attempt backend login again to get a fresh token
          // and trigger AuthContext update
          const backendResponse = await backendLoginFirebase(idToken, auth.currentUser.email);
          if (backendResponse && backendResponse.token) {
            await updateBackendToken(backendResponse.token, backendResponse.emailVerified); // Update backend token and emailVerified in AuthContext
            // Navigation to Main is handled by AuthContext's isAuthenticated state change
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
          {showVerificationMessage && (
            <View style={styles.verificationContainer}>
              <Typography variant="body" style={styles.verificationText}>
                Your email is not verified. Please check your inbox for a verification link.
              </Typography>
              <Button
                title="Resend Verification Email"
                onPress={handleResendVerification}
                style={styles.resendButton}
              />
              <TouchableOpacity onPress={handleVerifiedCheck} style={styles.verifiedCheckPrompt}>
                <Typography variant="button" style={styles.linkLink}>
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
  verificationContainer: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.warning100,
    borderRadius: Radii.md,
    alignItems: 'center',
    width: '100%',
  },
  verificationText: {
    color: Colors.warning900,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  resendButton: {
    width: '100%',
    marginBottom: Spacing.sm,
  },
  verifiedCheckPrompt: {
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