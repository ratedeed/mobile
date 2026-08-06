import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { backendLoginFirebase, syncEmailVerificationStatus, appleSignIn, getContractorProfile } from '../api';
import { auth } from '../firebaseConfig';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { BouncingDotsLoader } from '../components/common';
import { isDemoMode } from '../utils/demoMode';
import { generateDemoToken, DEMO_USER_ID, DEMO_CONTRACTOR_2_ID, demoUser, demoContractorUser } from '../utils/demoData';

const LoginScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigation = useNavigation();
  const route = useRoute();
  const { updateBackendToken } = useAuth();

  const verified = route.params?.verified;

  useEffect(() => {
    if (verified) {
      Toast.show({
        type: 'info',
        text1: 'Email Changed',
        text2: 'Your email has been changed. Use your new email to log in.',
        visibilityTime: 6000
      });
      navigation.setParams({ verified: undefined });
    }
  }, [verified]);

  const redirectContractor = async () => {
    try {
      await getContractorProfile();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }, { name: 'ContractorDashboard' }],
      });
    } catch (err) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }, { name: 'ContractorDashboard' }],
      });
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setShowVerificationMessage(user && !user.emailVerified);
    });
    return unsubscribe;
  }, []);

  const handleDemoLogin = async (role) => {
    setLoading(true);
    try {
      const isContractor = role === 'contractor';
      const userData = isContractor ? { ...demoContractorUser, _id: DEMO_CONTRACTOR_2_ID, userId: DEMO_CONTRACTOR_2_ID } : demoUser;
      const userId = isContractor ? DEMO_CONTRACTOR_2_ID : DEMO_USER_ID;
      const token = generateDemoToken(userId, role, userData.email);
      await updateBackendToken(token, true, userData);
      Toast.show({
        type: 'success',
        text1: 'Demo Mode',
        text2: `Signed in as demo ${role}.`,
      });
      if (isContractor) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }, { name: 'ContractorDashboard' }],
        });
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Main');
      }
    } catch (e) {
      setApiError(e.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter both email and password.' });
      return;
    }

    setApiError(null);
    setLoading(true);
    try {
      if (isDemoMode()) {
        const isContractor = trimmedEmail.includes('contractor') || trimmedEmail.includes('marcus');
        await handleDemoLogin(isContractor ? 'contractor' : 'user');
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
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
        const backendResponse = await backendLoginFirebase(idToken, trimmedEmail);
        if (backendResponse?.token) {
          const userData = backendResponse.user || backendResponse;
          await updateBackendToken(backendResponse.token, backendResponse.emailVerified, userData);
          Toast.show({ type: 'success', text1: 'Success', text2: 'Logged in successfully!' });
          if (userData.role === 'contractor') {
            await redirectContractor();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
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
          const userData = backendResponse.user || backendResponse;
          await updateBackendToken(backendResponse.token, backendResponse.emailVerified, userData);
          Toast.show({ type: 'success', text1: 'Success', text2: 'Logged in successfully!' });
          
          if (userData.role === 'contractor') {
            await redirectContractor();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        }
      } else {
        Toast.show({ type: 'info', text1: 'Not Verified', text2: 'Email still not verified. Check your inbox.' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      setLoading(true);
      const backendResponse = await appleSignIn({
        identityToken: credential.identityToken,
        appleUserIdentifier: credential.user,
        fullName: credential.fullName,
        email: credential.email,
      });

      if (backendResponse?.token) {
        const userData = backendResponse.user || backendResponse;
        await updateBackendToken(backendResponse.token, backendResponse.emailVerified, userData);
        Toast.show({ type: 'success', text1: 'Success', text2: 'Signed in with Apple!' });

        setTimeout(async () => {
          if (userData.role === 'contractor') {
            await redirectContractor();
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        }, 100);
      } else {
        setApiError('Apple Sign-In failed. Please try again.');
      }
    } catch (error) {
      if (error.code === 'ERR_CANCELED') {
        // User cancelled the sign-in flow
        return;
      }
      setApiError(error.message || 'Apple Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        keyboardShouldPersistTaps="handled"
      >
        {isDemoMode() && (
          <View className="mb-6 self-center bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1.5 flex-row items-center" style={{ gap: 6 }}>
            <FontAwesome5 name="film" size={11} color="#4F46E5" />
            <Text className="text-[11px] font-bold text-indigo-700">DEMO MODE</Text>
          </View>
        )}
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
            className="w-full border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
            placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
            accessibilityLabel="Email address"
            accessibilityRole="text"
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
            className="w-full border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 pr-20"
            placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
          />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 flex-row items-center h-8 px-2"
              style={{ gap: 4 }}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
            >
              <FontAwesome5
                name={showPassword ? 'eye-slash' : 'eye'}
                size={12}
                color={isDark ? "#ffffff" : "#171717"}
              />
              <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-50">
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
            <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5" style={{ gap: 10 }}>
              <View className="flex-row items-start" style={{ gap: 8 }}>
                <FontAwesome5 name="envelope" size={15} color="#b45309" style={{ marginTop: 2 }} />
                <Text className="text-xs text-amber-800 flex-1 leading-normal">
                  Your email is not verified. Please check your inbox for a verification link.
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 16 }}>
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
            </View>
          )}

          {/* Forgot Password */}
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} accessibilityLabel="Forgot password" accessibilityRole="link">
            <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-300">Forgot password?</Text>
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
            accessibilityLabel="Log in"
            accessibilityRole="button"
          >
            {loading ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <BouncingDotsLoader size="small" color="#fff" />
                <Text className="text-sm font-semibold text-white">Logging in...</Text>
              </View>
            ) : (
              <Text className="text-sm font-semibold text-white">Log In</Text>
            )}
          </Pressable>

          {/* Apple Sign In */}
          {Platform.OS === 'ios' && (
            <View className="w-full mt-4">
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ width: '100%', height: 48 }}
                onPress={handleAppleSignIn}
              />
            </View>
          )}

          {/* Sign Up Link */}
          <View className="items-center pt-4 flex-row justify-center" style={{ gap: 4 }}>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">Don't have an account?</Text>
            <Pressable onPress={() => navigation.navigate('Register')} accessibilityLabel="Sign up" accessibilityRole="link">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 underline">Sign Up</Text>
            </Pressable>
          </View>

          {/* Contractor Link */}
          <View className="items-center pt-2 flex-row justify-center" style={{ gap: 4 }}>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">Are you a contractor?</Text>
            <Pressable onPress={() => navigation.navigate('ContractorSignup')} accessibilityLabel="Sign up as a contractor" accessibilityRole="link">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 underline">Sign Up as a Contractor</Text>
            </Pressable>
          </View>

          {/* Demo Login Section */}
          {isDemoMode() && (
            <View className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl" style={{ gap: 12 }}>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <FontAwesome5 name="bolt" size={14} color="#b45309" />
                <Text className="text-[12px] font-bold text-amber-800 uppercase tracking-wider">One-tap demo login</Text>
              </View>
              <Text className="text-xs text-amber-700 leading-relaxed">
                Skip the form and jump into the app with a pre-populated demo account.
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => handleDemoLogin('user')}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl items-center bg-white border border-amber-300"
                  accessibilityLabel="Continue as demo homeowner"
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <FontAwesome5 name="home" size={14} color="#b45309" />
                  <Text className="text-xs font-bold text-amber-800 mt-1">As Homeowner</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDemoLogin('contractor')}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl items-center bg-white border border-amber-300"
                  accessibilityLabel="Continue as demo contractor"
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <FontAwesome5 name="hard-hat" size={14} color="#b45309" />
                  <Text className="text-xs font-bold text-amber-800 mt-1">As Contractor</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Legal Links */}
          <View className="items-center pt-4 flex-row justify-center" style={{ gap: 8 }}>
            <Pressable onPress={() => Linking.openURL('https://ratedeed.com/legal/terms')}>
              <Text className="text-xs text-neutral-400 underline">Terms of Service</Text>
            </Pressable>
            <Text className="text-xs text-neutral-400">•</Text>
            <Pressable onPress={() => Linking.openURL('https://ratedeed.com/legal/privacy')}>
              <Text className="text-xs text-neutral-400 underline">Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
