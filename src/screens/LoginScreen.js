import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { backendLoginFirebase, syncEmailVerificationStatus } from '../api';
import { auth } from '../firebaseConfig';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigation = useNavigation();
  const { updateBackendToken } = useAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setShowVerificationMessage(user && !user.emailVerified);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter both email and password.' });
      return;
    }

    setApiError(null);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await user.reload();
      const reloadedUser = auth.currentUser;

      if (!reloadedUser) {
        setApiError('User not found after reload. Please try again.');
        return;
      }

      if (!reloadedUser.emailVerified) {
        Toast.show({ type: 'info', text1: 'Verification Required', text2: 'Please verify your email address to continue.' });
        setShowVerificationMessage(true);
        return;
      }

      const idToken = await reloadedUser.getIdToken();

      try {
        const backendResponse = await backendLoginFirebase(idToken, email, password);
        if (backendResponse?.token) {
          await updateBackendToken(backendResponse.token, backendResponse.emailVerified, backendResponse.user);
          Toast.show({ type: 'success', text1: 'Success', text2: 'Logged in successfully!' });
        } else {
          setApiError('Backend authentication failed. Please try again.');
        }
      } catch (backendError) {
        setApiError(backendError.message || 'Backend authentication failed.');
      }
    } catch (error) {
      let errorMessage = 'An unexpected error occurred.';
      if (error.code) {
        const errorMap = {
          'auth/invalid-email': 'Invalid email address.',
          'auth/user-disabled': 'Your account has been disabled.',
          'auth/user-not-found': 'Email or password is wrong',
          'auth/wrong-password': 'Email or password is wrong',
          'auth/invalid-credential': 'Email or password is wrong',
          'auth/too-many-requests': 'Too many login attempts. Please try again later.',
        };
        errorMessage = errorMap[error.code] || error.message;
      }
      setApiError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (auth?.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        Toast.show({ type: 'success', text1: 'Success', text2: 'Verification email sent!' });
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Error', text2: error.message });
      }
    }
  };

  const handleVerifiedCheck = async () => {
    if (!auth.currentUser) return;
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        const idToken = await auth.currentUser.getIdToken();
        await syncEmailVerificationStatus(idToken, auth.currentUser.email, true);
        setShowVerificationMessage(false);
        const backendResponse = await backendLoginFirebase(idToken, auth.currentUser.email);
        if (backendResponse?.token) {
          await updateBackendToken(backendResponse.token, backendResponse.emailVerified);
        }
      } else {
        Toast.show({ type: 'info', text1: 'Not Verified', text2: 'Email still not verified. Check your inbox.' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View className="items-center mb-10">
          <FontAwesome5 name="hammer" size={48} color="#4F46E5" />
          <Text className="text-2xl font-bold text-indigo-600 mt-3">ratedeed</Text>
        </View>

        {/* Form */}
        <View className="w-full max-w-sm mx-auto" style={{ gap: 16 }}>
          {/* Email */}
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />

          {/* Password */}
          <View className="relative">
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              editable={!loading}
              className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white pr-20"
              placeholderTextColor="#a3a3a3"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 flex-row items-center"
              style={{ gap: 4 }}
            >
              <FontAwesome5
                name={showPassword ? 'eye-slash' : 'eye'}
                size={12}
                color="#171717"
              />
              <Text className="text-xs font-semibold text-neutral-900">
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>

          {/* API Error */}
          {apiError && (
            <View className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
              <Text className="text-xs text-indigo-700">{apiError}</Text>
            </View>
          )}

          {/* Verification Message */}
          {showVerificationMessage && (
            <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" style={{ gap: 8 }}>
              <Text className="text-xs text-amber-800">
                Your email is not verified. Please check your inbox for a verification link.
              </Text>
              <Pressable onPress={handleResendVerification}>
                <Text className="text-xs font-semibold text-amber-900 underline">
                  Resend Verification Email
                </Text>
              </Pressable>
              <Pressable onPress={handleVerifiedCheck}>
                <Text className="text-xs font-semibold text-amber-900 underline">
                  I have verified my email
                </Text>
              </Pressable>
            </View>
          )}

          {/* Forgot Password */}
          <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
            <Text className="text-xs font-semibold text-neutral-500">Forgot password?</Text>
          </Pressable>

          {/* Login Button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl items-center"
            style={{
              backgroundColor: loading ? '#818cf8' : '#4F46E5',
              shadowColor: '#4F46E5',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {loading ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-sm font-semibold text-white">Logging in...</Text>
              </View>
            ) : (
              <Text className="text-sm font-semibold text-white">Log In</Text>
            )}
          </Pressable>

          {/* Sign Up Link */}
          <View className="items-center pt-4 flex-row justify-center" style={{ gap: 4 }}>
            <Text className="text-sm text-neutral-500">Don't have an account?</Text>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text className="text-sm font-semibold text-neutral-900 underline">Sign Up</Text>
            </Pressable>
          </View>

          {/* Contractor Link */}
          <View className="items-center pt-2 flex-row justify-center" style={{ gap: 4 }}>
            <Text className="text-sm text-neutral-500">Are you a contractor?</Text>
            <Pressable onPress={() => navigation.navigate('ContractorSignup')}>
              <Text className="text-sm font-semibold text-neutral-900 underline">Sign Up as a Contractor</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
