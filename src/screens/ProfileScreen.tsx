import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth as authModule } from '../firebaseConfig';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth';
import { changePassword as apiChangePassword, deleteAccount, requestEmailChange } from '../utils/apiClient';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  Text,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Modal,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../utils/cloudinary";
import { requestPhotoLibraryPermission } from '../utils/permissions';

import { getUserProfile, updateUserProfile, getBlockedUsers, unblockUser, getUserJobs, listConversations, getContractorProfile } from '../api';
import { useAuth } from '../context/AuthContext';
import * as Sentry from '@sentry/react-native';
import { User } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';
import { SvgImage } from '../components/common/SvgImage';
import { BouncingDotsLoader, BouncingRefreshScrollView } from '../components/common';
import { getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { useColorScheme } from 'nativewind';

// @ts-ignore
const auth = authModule as unknown as import('firebase/auth').Auth;

type RootStackParamList = {
  Profile: undefined;
  ContractorDashboard: undefined;
  Login: undefined;
  Explore: undefined;
};

// ─── Toggle ───────────────────────────────────────────────────────────
function Toggle({ label, description, defaultOn = false, onValueChange }: { label: string; description: string; defaultOn?: boolean; onValueChange?: (val: boolean) => void }) {
  const [on, setOn] = useState(defaultOn);
  const handleToggle = () => {
    const next = !on;
    setOn(next);
    onValueChange?.(next);
  };
  return (
    <View className="flex-row items-center justify-between py-4">
      <View className="flex-1 mr-5">
        <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">{label}</Text>
        {description ? <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-4">{description}</Text> : null}
      </View>
      <Pressable onPress={handleToggle} hitSlop={8}>
        <View className={`w-[51px] h-[31px] rounded-full p-[2px] ${on ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
          <View
            className={`w-[27px] h-[27px] rounded-full bg-white dark:bg-neutral-800 ${on ? 'ml-[20px]' : 'ml-0'}`}
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 }}
          />
        </View>
      </Pressable>
    </View>
  );
}

// ─── Dark Mode Toggle ─────────────────────────────────────────────────
function DarkModeToggle() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleToggle = async () => {
    const next = isDark ? 'light' : 'dark';
    setColorScheme(next);
    await AsyncStorage.setItem('theme_preference', next);
  };

  return (
    <View className="flex-row items-center justify-between py-4">
      <View className="flex-1 mr-5">
        <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">Dark Mode</Text>
        <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-4">Switch between light and dark themes</Text>
      </View>
      <Pressable onPress={handleToggle} hitSlop={8}>
        <View className={`w-[51px] h-[31px] rounded-full p-[2px] ${isDark ? 'bg-neutral-100' : 'bg-neutral-900'}`}>
          <View
            className={`w-[27px] h-[27px] rounded-full bg-white dark:bg-neutral-800 ${isDark ? 'ml-[20px]' : 'ml-0'}`}
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 }}
          />
        </View>
      </Pressable>
    </View>
  );
}

// ─── Styled Input ─────────────────────────────────────────────────────
function StyledInput(props: any) {
  const [focused, setFocused] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TextInput
      {...props}
      onFocus={(e: any) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e: any) => { setFocused(false); props.onBlur?.(e); }}
      className={`w-full rounded-lg px-3 text-[15px] text-neutral-900 dark:text-neutral-50 bg-neutral-50 dark:bg-neutral-900 ${
        focused
          ? 'border-2 border-neutral-900 dark:border-neutral-100'
          : 'border border-neutral-200 dark:border-neutral-800'
      } ${props.className || ''}`}
      style={[{ height: 56, paddingTop: 0, paddingBottom: 0 }, props.style]}
      placeholderTextColor={isDark ? '#525252' : '#b0b0b0'}
    />
  );
}

// ─── Settings Sheet ───────────────────────────────────────────────────
function SettingsSheet({ title, onClose, children, visible }: { title: string; onClose: () => void; children: React.ReactNode; visible: boolean }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={handleClose} animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Animated.View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }}>
          <Pressable className="absolute inset-0" onPress={handleClose} />
          <Animated.View style={{ transform: [{ translateY: slideAnim }], flexShrink: 1 }}>
            <View className="bg-white dark:bg-neutral-950 rounded-t-[24px]" style={{ flexShrink: 1 }}>
              <View className="items-center pt-3 pb-1">
                <View className="w-9 h-[5px] rounded-full bg-neutral-300 dark:bg-neutral-600" />
              </View>
              <View className="flex-row items-center justify-between px-6 pt-2 pb-4">
                <Text className="text-[20px] font-bold text-neutral-900 dark:text-neutral-50">{title}</Text>
                <Pressable onPress={handleClose} className="w-10 h-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <FontAwesome5 name="times" size={14} color="#737373" />
                </Pressable>
              </View>
              <ScrollView className="px-6 pb-12 max-h-[70vh]" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Section Label ────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[12px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.08em] mb-2">
      {children}
    </Text>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────
const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { logout, firebaseUser: authUser, isAuthenticated, updateBackendToken, backendToken } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isSocialUser = !auth.currentUser || auth.currentUser.providerData.some(p => p.providerId !== 'password');

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [ipZipCode, setIpZipCode] = useState<string>('');
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [defaultZip, setDefaultZip] = useState('');
  const [stats, setStats] = useState({ reviews: 0, messages: 0, projects: 0 });

  const dashboardScale = useRef(new Animated.Value(1)).current;

  const handleDashboardPressIn = () => {
    Animated.spring(dashboardScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };

  const handleDashboardPressOut = () => {
    Animated.spring(dashboardScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };

  useEffect(() => {
    if (user?.zipCode) {
      setDefaultZip(user.zipCode);
    } else if (ipZipCode && !defaultZip) {
      setDefaultZip(ipZipCode);
    }
  }, [user?.zipCode, ipZipCode]);

  const fetchIpZipCode = useCallback(async () => {
    try {
      const data = await (await fetch('https://free.freeipapi.com/api/json')).json();
      if (data.zipCode) setIpZipCode(data.zipCode);
    } catch { /* */ }
  }, []);

  const loadHapticsSetting = useCallback(async () => {
    try {
      const val = await AsyncStorage.getItem('haptics_enabled');
      if (val !== null) setHapticsEnabled(val === 'true');
    } catch { /* */ }
  }, []);

  const saveHapticsSetting = async (enabled: boolean) => {
    try { setHapticsEnabled(enabled); await AsyncStorage.setItem('haptics_enabled', enabled.toString()); } catch { /* */ }
  };

  useFocusEffect(useCallback(() => { fetchIpZipCode(); loadHapticsSetting(); }, [fetchIpZipCode, loadHapticsSetting]));

  const [editData, setEditData] = useState({ firstName: '', lastName: '', email: '', zipCode: '' });
  const [saving, setSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string>('');
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [emailNew, setEmailNew] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  const loadBlockedUsers = useCallback(async () => {
    setLoadingBlocked(true);
    try {
      const users = await getBlockedUsers();
      if (Array.isArray(users)) setBlockedUsers(users);
    } catch (err) {
      Sentry.captureException(err);
    } finally { setLoadingBlocked(false); }
  }, []);

  const handleUnblock = async (userId: string) => {
    try {
      await unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => u._id !== userId && u.id !== userId));
      Alert.alert('Unblocked', 'User has been unblocked.');
    } catch (err) {
      Sentry.captureException(err);
      Alert.alert('Error', 'Failed to unblock user.');
    }
  };

  const loadProfile = useCallback(async () => {
    try {
      const userData = await getUserProfile();
      if (!isMounted.current) return;
      setUser(userData);
      setEditData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        zipCode: userData.zipCode || '',
      });

      // Fetch dynamic stats
      try {
        const [jobsData, conversations] = await Promise.all([
          getUserJobs().catch(() => []),
          listConversations().catch(() => []),
        ]);
        
        let reviewCount = 0;
        if (userData.role === 'contractor' || userData.role === 'admin') {
          const cProfile = await getContractorProfile().catch(() => null);
          const val = cProfile?.reviewCount as any;
          reviewCount = typeof val === 'number' ? val : (Array.isArray(val) ? val.length : 0);
        }

        setStats({
          reviews: reviewCount,
          messages: conversations?.length || 0,
          projects: jobsData?.length || 0,
        });
      } catch (statsErr) {
        console.warn('Failed to load profile stats:', statsErr);
      }
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      if (isMounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  const isMounted = React.useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
    }
  }, [backendToken, isAuthenticated, loadProfile]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadProfile(); }, [loadProfile]);

  const handleUpdateProfilePic = async () => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets?.length > 0) {
        setProfilePicUri(result.assets[0].uri);
        setProfilePicPreview(result.assets[0].uri);
      }
    } catch { setEditMessage({ type: "error", text: "Failed to pick image." }); }
  };

  const handleSaveProfile = async () => {
    setSaving(true); setEditMessage(null);
    try {
      let finalProfilePicUrl = user?.profilePicture;
      if (profilePicUri) finalProfilePicUrl = await uploadToCloudinary(profilePicUri, CLOUDINARY_FOLDERS.USER_PROFILE);
      const data = await updateUserProfile({ ...editData, profilePicture: finalProfilePicUrl });
      setUser(data);
      setEditMessage({ type: 'success', text: 'Profile updated!' });
      setTimeout(() => { setActiveSheet(null); setProfilePicPreview(''); setProfilePicUri(null); }, 1500);
    } catch (err: any) { setEditMessage({ type: 'error', text: err?.message || 'Failed to update.' }); }
    finally { setSaving(false); }
  };

  const handleChangeEmail = async () => {
    setEmailMessage(null);
    if (isSocialUser) { setEmailMessage({ type: 'error', text: 'Email changes are managed by your identity provider.' }); return; }
    if (!emailNew || !emailPassword) { setEmailMessage({ type: 'error', text: 'New email and current password required.' }); return; }
    setEmailSaving(true);
    try {
      if (!auth.currentUser) throw new Error('You must be logged in.');
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user?.email || '', emailPassword));
      // Trigger Firebase email change verification directly on mobile
      await verifyBeforeUpdateEmail(auth.currentUser, emailNew.trim());
      
      // Log out immediately from both backend and frontend store/state
      await logout();

      // Close sheet and reset states
      setActiveSheet(null);
      setEmailNew('');
      setEmailPassword('');

      // Redirect to Login Screen with param
      (navigation as any).navigate('Login', { verified: true });
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') setEmailMessage({ type: 'error', text: 'Current password is incorrect.' });
      else if (err.code === 'auth/email-already-in-use') setEmailMessage({ type: 'error', text: 'This email is already in use.' });
      else if (err.code === 'auth/too-many-requests') setEmailMessage({ type: 'error', text: 'Too many attempts. Try again later.' });
      else setEmailMessage({ type: 'error', text: err?.message || 'Failed.' });
    } finally { setEmailSaving(false); }
  };

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (isSocialUser) { setPwMessage({ type: 'error', text: 'Password changes are managed by your identity provider.' }); return; }
    if (!currentPassword || !newPassword || !confirmPassword) { setPwMessage({ type: 'error', text: 'All fields required.' }); return; }
    if (newPassword.length < 8) { setPwMessage({ type: 'error', text: 'Minimum 8 characters.' }); return; }
    if (newPassword !== confirmPassword) { setPwMessage({ type: 'error', text: 'Passwords do not match.' }); return; }
    setPwSaving(true);
    try {
      if (!auth.currentUser || !user?.email) throw new Error('You must be logged in.');
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(auth.currentUser, newPassword);
      
      // Request fresh Firebase token after password changes
      await auth.currentUser.getIdToken(true);

      const res = await apiChangePassword(currentPassword, newPassword);
      if (res && res.token) {
        await updateBackendToken(res.token, true, { refreshToken: res.refreshToken });
      }

      setPwMessage({ type: 'success', text: 'Password changed!' });
      setTimeout(() => { setActiveSheet(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }, 1500);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') setPwMessage({ type: 'error', text: 'Current password is incorrect.' });
      else setPwMessage({ type: 'error', text: err?.message || 'Failed to change password.' });
    } finally { setPwSaving(false); }
  };

  const handleUpdateZipCode = async (newZip: string) => {
    try {
      const updatedUser = await updateUserProfile({ zipCode: newZip });
      setUser(updatedUser);
      setEditData(prev => ({ ...prev, zipCode: newZip }));
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center px-8" style={{ paddingTop: Math.max(insets.top, 20) }}>
        <View className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-900/30 items-center justify-center mb-6">
          <FontAwesome5 name="user" size={32} color="#4F46E5" />
        </View>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2 text-center">Welcome to Ratedeed</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-8 leading-5">
          Sign in to save contractors, message pros, and manage your projects.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Login')}
          className="w-full py-4 bg-indigo-600 rounded-2xl items-center mb-3"
        >
          <Text className="text-white font-bold text-[15px]">Sign In or Create Account</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Explore' as any)} className="w-full py-4 rounded-2xl items-center">
          <Text className="text-neutral-500 dark:text-neutral-400 font-semibold text-[15px]">Continue Browsing</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950 items-center justify-center">
        <BouncingDotsLoader size="large" color="#4F46E5" />
      </View>
    );
  }

  const closeSheet = () => setActiveSheet(null);

  const menuSections = [
    {
      heading: 'Account',
      items: [
        { icon: 'user-edit', label: 'Edit Profile', sheet: 'edit-profile', iconColor: '#4F46E5', iconBg: 'bg-indigo-50 dark:bg-indigo-950' },
        { icon: 'bell', label: 'Notifications', sheet: 'notifications', iconColor: '#D97706', iconBg: 'bg-amber-50 dark:bg-amber-950' },
      ],
    },
    {
      heading: 'Support',
      items: [
        { icon: 'shield-alt', label: 'Privacy & Security', sheet: 'privacy', iconColor: '#059669', iconBg: 'bg-emerald-50 dark:bg-emerald-950' },
        { icon: 'cog', label: 'App Settings', sheet: 'settings', iconColor: '#6B7280', iconBg: 'bg-neutral-100 dark:bg-neutral-800' },
        { icon: 'question-circle', label: 'Help Center', sheet: 'help', iconColor: '#2563EB', iconBg: 'bg-blue-50 dark:bg-blue-950' },
      ],
    },
  ];

  const faqs = [
    { q: 'How does escrow work?', a: 'Your money is held securely in escrow. The contractor only receives payment after you approve the completed work.' },
    { q: 'How do I request a quote?', a: 'Browse contractors, find one you like, and tap "Request Quote." Fill out the job details and submit.' },
    { q: 'What if I\'m not satisfied?', a: 'Your payment is protected by escrow. If work doesn\'t meet expectations, you can dispute the release of funds.' },
    { q: 'How are contractors verified?', a: 'Contractors go through license checks, insurance verification, background checks, and review of references.' },
    { q: 'Can I cancel a job?', a: 'You can cancel before payment at no cost. After payment, cancellation depends on the project stage.' },
  ];

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <BouncingRefreshScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshing={refreshing} onRefresh={onRefresh} loaderColor="#4F46E5">
        {/* Profile Header */}
        <View className="px-6 pt-4 pb-2">
          <View className="flex-row items-center" style={{ gap: 20 }}>
            <Pressable onPress={() => setActiveSheet('edit-profile')}>
              <View className="relative">
                <View style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5 }}>
                  {(() => {
                    const avatarUrl = getProfileImageUrl(user?.firstName || 'User', user?.profilePicture || '');
                    return isSvgUrl(avatarUrl) ? (
                      <View className="w-[88px] h-[88px] rounded-full overflow-hidden" style={{ borderWidth: 3, borderColor: isDark ? '#262626' : '#ffffff' }}>
                        <SvgImage uri={avatarUrl} width="100%" height="100%" />
                      </View>
                    ) : (
                      <Image source={{ uri: avatarUrl }} style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: isDark ? '#262626' : '#ffffff' }} />
                    );
                  })()}
                </View>
                <View className="absolute -bottom-0.5 -right-0.5 w-8 h-8 bg-neutral-900 dark:bg-neutral-100 rounded-full items-center justify-center" style={{ borderWidth: 3, borderColor: isDark ? '#0a0a0a' : '#f5f5f5' }}>
                  <FontAwesome5 name="pen" size={10} color={isDark ? '#171717' : '#ffffff'} />
                </View>
              </View>
            </Pressable>

            <View className="flex-1" style={{ gap: 3 }}>
              <Text className="text-[26px] font-bold text-neutral-900 dark:text-neutral-50 leading-tight tracking-tight">
                {user?.firstName || 'User'} {user?.lastName || ''}
              </Text>
              <Text className="text-[15px] text-neutral-400 dark:text-neutral-500">{user?.email || ''}</Text>
              {(user?.role === 'contractor' || user?.role === 'admin') && (
                <TouchableWithoutFeedback
                  onPress={() => navigation.navigate('ContractorDashboard')}
                  onPressIn={handleDashboardPressIn}
                  onPressOut={handleDashboardPressOut}
                >
                  <Animated.View
                    className="mt-2 self-start flex-row items-center py-2 px-4 bg-neutral-900 dark:bg-neutral-100 rounded-xl"
                    style={{
                      gap: 8,
                      transform: [{ scale: dashboardScale }]
                    }}
                  >
                    <FontAwesome5 name="briefcase" size={11} color={isDark ? '#171717' : '#ffffff'} />
                    <Text className="text-[13px] font-semibold text-white dark:text-neutral-900">Contractor Dashboard</Text>
                  </Animated.View>
                </TouchableWithoutFeedback>
              )}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="px-6 py-5">
          <View className="flex-row" style={{ gap: 10 }}>
            {[
              { value: String(stats.reviews), label: 'Reviews' },
              { value: String(stats.messages), label: 'Messages' },
              { value: String(stats.projects), label: 'Projects' }
            ].map((stat, i) => (
              <View key={i} className="flex-1 bg-white dark:bg-neutral-900 rounded-2xl py-4 px-3 items-center" style={{ borderWidth: 1, borderColor: isDark ? '#262626' : '#f0f0f0' }}>
                <Text className="text-[22px] font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">{stat.value}</Text>
                <Text className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500 mt-1">{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Menu Sections */}
        <View className="mt-2">
          {menuSections.map((section, sectionIdx) => (
            <View key={sectionIdx} className="mb-5">
              <View className="px-6 mb-2">
                <SectionLabel>{section.heading}</SectionLabel>
              </View>
              <View className="mx-6 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900" style={{ borderWidth: 1, borderColor: isDark ? '#262626' : '#f0f0f0' }}>
                {section.items.map((item, i) => (
                  <Pressable
                    key={item.label}
                    onPress={() => setActiveSheet(item.sheet)}
                    className={`flex-row items-center px-5 py-[16px] active:bg-neutral-50 dark:active:bg-neutral-800 ${i < section.items.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''}`}
                    style={{ gap: 14 }}
                  >
                    <View className={`w-10 h-10 rounded-xl items-center justify-center ${item.iconBg}`}>
                      <FontAwesome5 name={item.icon as any} size={16} color={item.iconColor} />
                    </View>
                    <Text className="flex-1 text-[16px] font-medium text-neutral-900 dark:text-neutral-50">{item.label}</Text>
                    <FontAwesome5 name="chevron-right" size={11} color="#c4c4c4" />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* Log Out */}
          <View className="mx-6 mb-24 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900" style={{ borderWidth: 1, borderColor: isDark ? '#262626' : '#f0f0f0' }}>
            <Pressable onPress={handleLogout} className="flex-row items-center px-5 py-[16px] active:bg-red-50 dark:active:bg-red-950" style={{ gap: 14 }}>
              <View className="w-10 h-10 rounded-xl items-center justify-center bg-red-50 dark:bg-red-950">
                <FontAwesome5 name="sign-out-alt" size={16} color="#EF4444" />
              </View>
              <Text className="flex-1 text-[16px] font-medium text-red-500">Log Out</Text>
            </Pressable>
          </View>
        </View>
      </BouncingRefreshScrollView>

      {/* Sheets */}
      <SettingsSheet title="Edit Profile" onClose={closeSheet} visible={activeSheet === 'edit-profile'}>
        <View className="items-center mb-6">
          <Pressable onPress={handleUpdateProfilePic}>
            <View className="relative">
              {(() => {
                const sheetAvatarUri = profilePicPreview || user?.profilePicture || getProfileImageUrl(user?.firstName || 'User', '');
                return isSvgUrl(sheetAvatarUri) ? (
                  <View style={{ width: 88, height: 88, borderRadius: 44, overflow: 'hidden' }}>
                    <SvgImage uri={sheetAvatarUri} width="100%" height="100%" />
                  </View>
                ) : (
                  <Image source={{ uri: sheetAvatarUri }} style={{ width: 88, height: 88, borderRadius: 44 }} />
                );
              })()}
              <View className="absolute -bottom-0.5 -right-0.5 w-8 h-8 bg-neutral-900 dark:bg-neutral-100 rounded-full items-center justify-center" style={{ borderWidth: 3, borderColor: isDark ? '#171717' : '#ffffff' }}>
                <FontAwesome5 name="camera" size={11} color={isDark ? '#171717' : '#ffffff'} />
              </View>
            </View>
          </Pressable>
        </View>

        {editMessage && (
          <View className={`mb-5 px-4 py-3 rounded-xl ${editMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <Text className={`text-[14px] font-medium ${editMessage.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{editMessage.text}</Text>
          </View>
        )}

        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">First name</Text>
        <StyledInput value={editData.firstName} onChangeText={(t: string) => setEditData(p => ({ ...p, firstName: t }))} className="mb-5" />

        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Last name</Text>
        <StyledInput value={editData.lastName} onChangeText={(t: string) => setEditData(p => ({ ...p, lastName: t }))} className="mb-5" />

        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Email</Text>
        <View className="flex-row items-center mb-5" style={{ gap: 10 }}>
          <StyledInput value={user?.email} editable={false} className="flex-1 text-neutral-400" />
          <Pressable onPress={() => setActiveSheet('change-email')} className="px-1">
            <Text className="text-[14px] font-semibold text-indigo-600 dark:text-indigo-400">Change</Text>
          </Pressable>
        </View>

        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Zip code</Text>
        <StyledInput value={editData.zipCode} onChangeText={(t: string) => setEditData(p => ({ ...p, zipCode: t }))} keyboardType="numeric" maxLength={10} className="mb-6" />

        <Pressable onPress={handleSaveProfile} disabled={saving} className="w-full h-[52px] bg-neutral-900 dark:bg-neutral-100 rounded-xl items-center justify-center flex-row" style={{ gap: 8 }}>
          {saving && <BouncingDotsLoader size="small" color={isDark ? '#171717' : '#ffffff'} />}
          <Text className="text-[15px] font-semibold text-white dark:text-neutral-900">{saving ? 'Saving...' : 'Save Changes'}</Text>
        </Pressable>
      </SettingsSheet>

      <SettingsSheet title="Notifications" onClose={closeSheet} visible={activeSheet === 'notifications'}>
        <SectionLabel>Push Notifications</SectionLabel>
        <Toggle label="Job Updates" description="When a contractor responds to your quote request" defaultOn />
        <Toggle label="New Messages" description="When you receive a new message" defaultOn />
        <Toggle label="Payment Status" description="When payment is confirmed or released" defaultOn />
        <View className="mt-4">
          <SectionLabel>Email</SectionLabel>
          <Toggle label="Job Summary" description="Weekly digest of your active projects" defaultOn />
        </View>
      </SettingsSheet>

      <SettingsSheet title="Privacy & Security" onClose={closeSheet} visible={activeSheet === 'privacy'}>
        {!isSocialUser && (
          <Pressable onPress={() => { closeSheet(); setTimeout(() => setActiveSheet('change-password'), 350); }} className="flex-row items-center justify-between py-4 active:opacity-60">
            <View className="flex-1 mr-4">
              <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">Change Password</Text>
              <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5">Update your account password</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#c4c4c4" />
          </Pressable>
        )}
        {!isSocialUser && (
          <Pressable onPress={() => { closeSheet(); setTimeout(() => setActiveSheet('change-email'), 350); }} className="flex-row items-center justify-between py-4 active:opacity-60">
            <View className="flex-1 mr-4">
              <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">Change Email</Text>
              <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5">Update your email address</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#c4c4c4" />
          </Pressable>
        )}
        <View className={`pt-5 mt-2 ${!isSocialUser ? 'border-t border-neutral-100 dark:border-neutral-800' : ''}`}>
          <SectionLabel>Data &amp; Privacy</SectionLabel>
          <Pressable onPress={() => { closeSheet(); setTimeout(() => { setActiveSheet('blocked-users'); loadBlockedUsers(); }, 350); }} className="flex-row items-center justify-between py-4 active:opacity-60">
            <View className="flex-1 mr-4">
              <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">Blocked Users</Text>
              <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5">Manage users you've blocked</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#c4c4c4" />
          </Pressable>
          <Pressable onPress={() => { closeSheet(); Linking.openURL('https://ratedeed.com/legal/privacy'); }} className="flex-row items-center justify-between py-4 active:opacity-60">
            <View className="flex-1 mr-4">
              <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">Privacy Policy</Text>
              <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5">View our privacy policy</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#c4c4c4" />
          </Pressable>
          <Pressable onPress={() => { closeSheet(); Linking.openURL('https://ratedeed.com/legal/terms'); }} className="flex-row items-center justify-between py-4 active:opacity-60">
            <View className="flex-1 mr-4">
              <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">Terms of Service</Text>
              <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5">View our terms of service</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#c4c4c4" />
          </Pressable>
        </View>
        <View className="pt-5 mt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Pressable
            onPress={() => Alert.alert('Delete Account', 'This will delete your account and profile. Some records (such as messages and payment history) may be retained for legal and administrative purposes. This action cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteAccount(); await logout(); } catch { Alert.alert('Error', 'Failed to delete account.'); } } },
            ])}
            className="py-4 active:opacity-60"
          >
            <Text className="text-[15px] font-semibold text-red-500">Delete Account</Text>
            <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5">Permanently delete your account and all data</Text>
          </Pressable>
        </View>
      </SettingsSheet>

      <SettingsSheet title="Change Email" onClose={closeSheet} visible={activeSheet === 'change-email'}>
        {emailMessage && (
          <View className={`mb-5 px-4 py-3 rounded-xl ${emailMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <Text className={`text-[14px] font-medium ${emailMessage.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{emailMessage.text}</Text>
          </View>
        )}
        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Current Email</Text>
        <StyledInput value={user?.email} editable={false} className="mb-5 text-neutral-400" />
        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">New Email</Text>
        <StyledInput value={emailNew} onChangeText={setEmailNew} keyboardType="email-address" autoCapitalize="none" className="mb-5" placeholder="Enter new email" />
        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Current Password</Text>
        <StyledInput value={emailPassword} onChangeText={setEmailPassword} secureTextEntry className="mb-6" placeholder="Enter current password" />
        <Pressable onPress={handleChangeEmail} disabled={emailSaving} className="w-full h-[52px] bg-neutral-900 dark:bg-neutral-100 rounded-xl items-center justify-center flex-row" style={{ gap: 8 }}>
          {emailSaving && <BouncingDotsLoader size="small" color={isDark ? '#171717' : '#ffffff'} />}
          <Text className="text-[15px] font-semibold text-white dark:text-neutral-900">{emailSaving ? 'Sending...' : 'Send Verification Email'}</Text>
        </Pressable>
        <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 text-center mt-4 leading-[18px]">We'll send a verification link to your new email address.</Text>
      </SettingsSheet>

      <SettingsSheet title="Change Password" onClose={closeSheet} visible={activeSheet === 'change-password'}>
        {pwMessage && (
          <View className={`mb-5 px-4 py-3 rounded-xl ${pwMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-red-50 dark:bg-red-950'}`}>
            <Text className={`text-[14px] font-medium ${pwMessage.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{pwMessage.text}</Text>
          </View>
        )}
        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Current Password</Text>
        <StyledInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry className="mb-5" placeholder="Enter current password" />
        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">New Password</Text>
        <StyledInput value={newPassword} onChangeText={setNewPassword} secureTextEntry className="mb-1" placeholder="Enter new password" />
        <Text className="text-[12px] text-neutral-400 dark:text-neutral-500 mb-5">Minimum 8 characters</Text>
        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Confirm New Password</Text>
        <StyledInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry className="mb-6" placeholder="Re-enter new password" />
        <Pressable onPress={handleChangePassword} disabled={pwSaving} className="w-full h-[52px] bg-neutral-900 dark:bg-neutral-100 rounded-xl items-center justify-center flex-row" style={{ gap: 8 }}>
          {pwSaving && <BouncingDotsLoader size="small" color={isDark ? '#171717' : '#ffffff'} />}
          <Text className="text-[15px] font-semibold text-white dark:text-neutral-900">{pwSaving ? 'Updating...' : 'Change Password'}</Text>
        </Pressable>
      </SettingsSheet>

      <SettingsSheet title="App Settings" onClose={closeSheet} visible={activeSheet === 'settings'}>
        <Text className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 mb-2">Default Service Area</Text>
        <StyledInput 
          value={defaultZip} 
          onChangeText={setDefaultZip}
          onBlur={() => {
            if (defaultZip && defaultZip !== user?.zipCode) {
              handleUpdateZipCode(defaultZip);
            }
          }}
          onSubmitEditing={() => {
            if (defaultZip && defaultZip !== user?.zipCode) {
              handleUpdateZipCode(defaultZip);
            }
          }}
          keyboardType="numeric"
          maxLength={10}
          className="mb-5" 
        />
        <View className="border-t border-neutral-100 dark:border-neutral-800 pt-2">
          <DarkModeToggle />
        </View>
        <View className="pt-5 mt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Text className="text-[12px] text-neutral-300 dark:text-neutral-600">Version 1.0.0 · Build 2026.04</Text>
        </View>
        <View className="pt-4 mt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Pressable
            onPress={() => Alert.alert('Delete Account', 'This will delete your account and profile. Some records (such as messages and payment history) may be retained for legal and administrative purposes. This action cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteAccount(); await logout(); } catch { Alert.alert('Error', 'Failed to delete account.'); } } },
            ])}
            className="py-4 active:opacity-60"
          >
            <Text className="text-[15px] font-semibold text-red-500">Delete Account</Text>
            <Text className="text-[13px] text-neutral-400 dark:text-neutral-500 mt-0.5">Permanently delete your account and all data</Text>
          </Pressable>
        </View>
      </SettingsSheet>

      <SettingsSheet title="Help Center" onClose={closeSheet} visible={activeSheet === 'help'}>
        <SectionLabel>Frequently Asked Questions</SectionLabel>
        {faqs.map((faq, i) => (
          <View key={i} className="border-b border-neutral-100 dark:border-neutral-800">
            <Pressable onPress={() => setOpenFaq(openFaq === i ? null : i)} className="flex-row items-center justify-between py-4 active:opacity-60">
              <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50 flex-1 mr-4 leading-[20px]">{faq.q}</Text>
              <FontAwesome5 name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={11} color="#a3a3a3" />
            </Pressable>
            {openFaq === i && <Text className="text-[14px] text-neutral-500 dark:text-neutral-400 leading-[22px] pb-4">{faq.a}</Text>}
          </View>
        ))}
        <View className="pt-6 mt-2 border-t border-neutral-100 dark:border-neutral-800 items-center">
          <Text className="text-[14px] text-neutral-400 dark:text-neutral-500 mb-4">Still need help?</Text>
          <Pressable onPress={() => Linking.openURL('mailto:support@ratedeed.com')} className="w-full h-[52px] bg-neutral-900 dark:bg-neutral-100 rounded-xl items-center justify-center">
            <Text className="text-[15px] font-semibold text-white dark:text-neutral-900">Contact Support</Text>
          </Pressable>
        </View>
      </SettingsSheet>

      <SettingsSheet title="Blocked Users" onClose={closeSheet} visible={activeSheet === 'blocked-users'}>
        {loadingBlocked ? (
          <View className="items-center py-10">
            <BouncingDotsLoader size="small" color="#4F46E5" />
          </View>
        ) : blockedUsers.length === 0 ? (
          <View className="items-center py-10">
            <Text className="text-[15px] text-neutral-400 dark:text-neutral-500">No blocked users</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {blockedUsers.map((blockedUser) => (
              <View key={blockedUser._id || blockedUser.id} className="flex-row items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-800">
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  {(() => {
                    const avatarUrl = getProfileImageUrl(blockedUser.firstName || 'User', blockedUser.profilePicture || '');
                    return isSvgUrl(avatarUrl) ? (
                      <View className="w-10 h-10 rounded-full overflow-hidden">
                        <SvgImage uri={avatarUrl} width="100%" height="100%" />
                      </View>
                    ) : (
                      <Image source={{ uri: avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    );
                  })()}
                  <View>
                    <Text className="text-[15px] font-medium text-neutral-900 dark:text-neutral-50">
                      {blockedUser.firstName || ''} {blockedUser.lastName || ''}
                    </Text>
                    <Text className="text-[13px] text-neutral-400 dark:text-neutral-500">{blockedUser.email || ''}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleUnblock(blockedUser._id || blockedUser.id)}
                  className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800"
                >
                  <Text className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300">Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </SettingsSheet>
    </View>
  );
};

export default ProfileScreen;
