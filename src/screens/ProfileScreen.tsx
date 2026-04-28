import { auth } from '../firebaseConfig';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth';
import { requestEmailChange, changePassword as apiChangePassword } from '../utils/apiClient';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Text,
  Image,
  RefreshControl,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../utils/cloudinary";

import { getUserProfile, updateUserProfile, updateProfilePicture } from '../api';
import { put, getAuthHeaders } from '../api';
import { API_BASE_URL } from '../config';

const changePassword = async (currentPassword: string, newPassword: string) => {
  const headers = await getAuthHeaders();
  return put(`${API_BASE_URL}/api/users/password`, { currentPassword, newPassword }, headers);
};
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { SvgImage } from '../components/common/SvgImage';
import { getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';

type RootStackParamList = {
  Profile: undefined;
  ContractorDashboard: undefined;
  EditProfile: undefined;
  Settings: undefined;
};

// ---- Toggle Component ----
function Toggle({ label, description, defaultOn = false, onValueChange }: { label: string; description: string; defaultOn?: boolean; onValueChange?: (val: boolean) => void }) {
  const [on, setOn] = useState(defaultOn);
  const handleToggle = () => {
    const next = !on;
    setOn(next);
    onValueChange?.(next);
  };
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-800">
      <View className="flex-1 mr-4">
        <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{label}</Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{description}</Text>
      </View>
      <Pressable onPress={handleToggle}>
        <View className={`w-12 h-7 rounded-full relative ${on ? 'bg-indigo-600' : 'bg-neutral-300'}`}>
          <View className={`w-5 h-5 bg-white dark:bg-neutral-950 rounded-full absolute top-1 ${on ? 'right-1' : 'left-1'}`} style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 1 }} />
        </View>
      </Pressable>
    </View>
  );
}

// ---- Settings Sheet ----
function SettingsSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <View className="absolute inset-0 z-[90] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <Pressable className="flex-1" onPress={onClose} />
      <View className="bg-white dark:bg-neutral-950 rounded-t-3xl">
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">{title}</Text>
          <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full">
            <FontAwesome5 name="times" size={16} color="#737373" />
          </Pressable>
        </View>
        <ScrollView className="px-5 py-4 pb-10 max-h-[70vh]">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// ---- Profile Screen ----
const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { logout, userId, firebaseUser: authUser } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const { colorScheme, setColorScheme } = useColorScheme();


  // Edit profile state
  const [editData, setEditData] = useState({ firstName: '', lastName: '', email: '', zipCode: '' });
  const [saving, setSaving] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [emailNew, setEmailNew] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{type: "success" | "error"; text: string} | null>(null);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const userData = await getUserProfile();
      setUser(userData);
      setEditData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        zipCode: userData.zipCode || '',
      });
    } catch (err) {
      // console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const onRefresh = useCallback(() => { setRefreshing(true); loadProfile(); }, [loadProfile]);
  const handleUpdateProfilePic = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSaving(true);
        setEditMessage(null);
        const localUri = result.assets[0].uri;
        try {
          const secureUrl = await uploadToCloudinary(localUri, CLOUDINARY_FOLDERS.USER_PROFILE);
          const updatedUser = await updateProfilePicture(secureUrl);
          setUser(updatedUser);
          setEditMessage({ type: "success", text: "Profile picture updated!" });
        } catch (uploadErr) {
      // console.error("Image upload failed", uploadErr);
          setEditMessage({ type: "error", text: "Failed to upload image. Please try again." });
        }
      }
    } catch (err) {
      // console.error("Failed to pick image:", err);
      setEditMessage({ type: "error", text: "Failed to pick image." });
    } finally {
      setSaving(false);
    }
  };


  const handleSaveProfile = async () => {
    setSaving(true);
    setEditMessage(null);
    try {
      const data = await updateUserProfile(editData);
      setUser(data);
      setEditMessage({ type: 'success', text: 'Profile updated!' });
      setTimeout(() => setActiveSheet(null), 1500);
    } catch (err: any) {
      setEditMessage({ type: 'error', text: err?.message || 'Failed to update.' });
    } finally {
      setSaving(false);
    }
  };

  
  const handleChangeEmail = async () => {
    setEmailMessage(null);
    if (!emailNew || !emailPassword) {
      setEmailMessage({ type: 'error', text: 'New email and current password required.' });
      return;
    }
    setEmailSaving(true);
    try {
      
      const { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } = require('firebase/auth');

      if (!auth.currentUser) throw new Error('You must be logged in to change your email.');

      const credential = EmailAuthProvider.credential(user?.email || '', emailPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await verifyBeforeUpdateEmail(auth.currentUser, emailNew.trim());

      setEmailMessage({ type: 'success', text: 'Verification email sent to ' + emailNew.trim() + '. Please check your inbox to confirm, then log out and log back in to see the changes.' });
      setTimeout(() => { setActiveSheet(null); setEmailNew(''); setEmailPassword(''); }, 5000);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setEmailMessage({ type: 'error', text: 'Current password is incorrect.' });
      } else if (err.code === 'auth/email-already-in-use') {
        setEmailMessage({ type: 'error', text: 'This email is already associated with another account.' });
      } else if (err.code === 'auth/too-many-requests') {
        setEmailMessage({ type: 'error', text: 'Too many attempts. Please try again later.' });
      } else {
        setEmailMessage({ type: 'error', text: err?.message || 'Failed to request email change.' });
      }
    } finally {
      setEmailSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMessage({ type: 'error', text: 'All fields required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwMessage({ type: 'error', text: 'Minimum 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setPwSaving(true);
    try {
      
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = require('firebase/auth');

      if (!auth.currentUser || !user?.email) {
        throw new Error('You must be logged in to change your password.');
      }

      // 1. Re-authenticate with Firebase
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // 2. Update password in Firebase
      await updatePassword(auth.currentUser, newPassword);

      // 3. Sync with backend
      
      await apiChangePassword(currentPassword, newPassword);

      setPwMessage({ type: 'success', text: 'Password changed!' });
      setTimeout(() => { setActiveSheet(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }, 1500);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setPwMessage({ type: 'error', text: 'Current password is incorrect.' });
      } else {
        setPwMessage({ type: 'error', text: err?.message || 'Failed to change password.' });
      }
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-900 items-center justify-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const closeSheet = () => setActiveSheet(null);

  const menuItems = [
    { icon: 'user-edit', label: 'Edit Profile', sheet: 'edit-profile', desc: 'Name, email, phone, photo' },
    { icon: 'bell', label: 'Notifications', sheet: 'notifications', desc: 'Push, email, job updates' },
    { icon: 'shield-alt', label: 'Privacy & Security', sheet: 'privacy', desc: 'Password, 2FA, data' },
    { icon: 'cog', label: 'App Settings', sheet: 'settings', desc: 'Theme, language, defaults' },
    { icon: 'question-circle', label: 'Help Center', sheet: 'help', desc: 'FAQs, support, contact' },
  ];

  const faqs = [
    { q: 'How does escrow work?', a: 'Your money is held securely in escrow. The contractor only receives payment after you approve the completed work.' },
    { q: 'How do I request a quote?', a: 'Browse contractors, find one you like, and tap "Request Quote." Fill out the job details and submit.' },
    { q: 'What if I\'m not satisfied?', a: 'Your payment is protected by escrow. If work doesn\'t meet expectations, you can dispute the release of funds.' },
    { q: 'How are contractors verified?', a: 'Contractors go through license checks, insurance verification, background checks, and review of references.' },
    { q: 'Can I cancel a job?', a: 'You can cancel before payment at no cost. After payment, cancellation depends on the project stage.' },
  ];

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950" style={{ paddingTop: Math.max(insets.top, 16) }}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Profile Header */}
        <View className="bg-white dark:bg-neutral-950 px-4 pb-5">
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <View className="relative">
              <Pressable onPress={handleUpdateProfilePic}>
              {(() => {
                const avatarUrl = getProfileImageUrl(user?.firstName || 'User', user?.profilePicture || '');
                return isSvgUrl(avatarUrl) ? (
                  <View className="w-[72px] h-[72px] rounded-full overflow-hidden">
                    <SvgImage uri={avatarUrl} width="100%" height="100%" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: avatarUrl }}
                    className="w-[72px] h-[72px] rounded-full"
                  />
                );
              })()}
              <Pressable
                onPress={() => setActiveSheet('edit-profile')}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 rounded-full items-center justify-center border-2 border-white"
              >
                <FontAwesome5 name="pen" size={10} color="#fff" />
              </Pressable>
              </Pressable>
            </View>


            <View className="flex-1">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{user?.firstName || 'User'} {user?.lastName || ''}</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{user?.email || ''}</Text>
              <View className="flex-row mt-1" style={{ gap: 4 }}>
                <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-indigo-600 capitalize">{user?.role || 'User'}</Text>
                </View>
                <View className="bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">Since {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2024'}</Text>
                </View>
              </View>
              {(user?.role === 'contractor' || user?.role === 'admin') && (
                <Pressable
                  onPress={() => navigation.navigate('ContractorDashboard')}
                  className="mt-2 flex-row items-center justify-center py-2 bg-neutral-900 dark:bg-neutral-50 rounded-lg"
                  style={{ gap: 6 }}
                >
                  <FontAwesome5 name="briefcase" size={10} color="#fff" />
                  <Text className="text-xs font-semibold text-white dark:text-neutral-900">Switch to Contractor Dashboard</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="bg-white dark:bg-neutral-950 mt-2 px-4 py-4">
          <View className="flex-row">
            <View className="flex-1 items-center border-r border-neutral-200 dark:border-neutral-700">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">0</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Reviews</Text>
            </View>
            <View className="flex-1 items-center border-r border-neutral-200 dark:border-neutral-700">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">0</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Conversations</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">0</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Projects</Text>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View className="bg-white dark:bg-neutral-950 mt-2">
          {menuItems.map((item, i) => (
            <Pressable
              key={item.label}
              onPress={() => setActiveSheet(item.sheet)}
              className={`flex-row items-center px-4 py-3.5 ${i < menuItems.length - 1 ? 'border-b border-neutral-100 dark:border-neutral-800' : ''}`}
              style={{ gap: 12 }}
            >
              <FontAwesome5 name={item.icon} size={18} color="#404040" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{item.label}</Text>
                <Text className="text-[11px] text-neutral-400">{item.desc}</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={12} color="#a3a3a3" />
            </Pressable>
          ))}
        </View>

        {/* Log Out */}
        <View className="bg-white dark:bg-neutral-950 mt-2 mb-20">
          <Pressable onPress={handleLogout} className="flex-row items-center px-4 py-3.5" style={{ gap: 12 }}>
            <FontAwesome5 name="sign-out-alt" size={18} color="#4F46E5" />
            <Text className="text-sm font-medium text-indigo-500">Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit Profile Sheet */}
      {activeSheet === 'edit-profile' && (
        <SettingsSheet title="Edit Profile" onClose={closeSheet}>
          <View className="items-center mb-4">
            <View className="relative">
              <Pressable onPress={handleUpdateProfilePic}>
                <Image
                  source={{ uri: user?.profilePicture || "" }}
                  className="w-20 h-20 rounded-full bg-neutral-200 dark:bg-neutral-800"
                />
                <View className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 rounded-full items-center justify-center border-2 border-white">
                  <FontAwesome5 name="pen" size={10} color="#fff" />
                </View>
              </Pressable>
            </View>
          </View>

          {editMessage && (
            <View className={`mb-4 px-3 py-2 rounded-lg ${editMessage.type === 'success' ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
              <Text className={`text-sm ${editMessage.type === 'success' ? 'text-emerald-700' : 'text-indigo-700'}`}>{editMessage.text}</Text>
            </View>
          )}
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">First name</Text>
          <TextInput value={editData.firstName} onChangeText={t => setEditData(p => ({ ...p, firstName: t }))} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" />
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Last name</Text>
          <TextInput value={editData.lastName} onChangeText={t => setEditData(p => ({ ...p, lastName: t }))} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" />
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Email</Text>
          <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
            <TextInput 
              value={user?.email} 
              editable={false} 
              className="flex-1 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-500 bg-neutral-50 dark:bg-neutral-800" 
            />
            <Pressable onPress={() => { setActiveSheet('change-email'); }} className="px-2">
              <Text className="text-xs font-semibold text-indigo-600">Change</Text>
            </Pressable>
          </View>
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Zip code</Text>
          <TextInput value={editData.zipCode} onChangeText={t => setEditData(p => ({ ...p, zipCode: t }))} keyboardType="numeric" maxLength={10} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" />
          <Pressable onPress={handleSaveProfile} disabled={saving} className="w-full py-3 bg-indigo-600 rounded-xl items-center mt-2 flex-row justify-center" style={{ gap: 8 }}>
            {saving && <ActivityIndicator size="small" color="#fff" />}
            <Text className="text-sm font-semibold text-white dark:text-neutral-900">{saving ? 'Saving...' : 'Save Changes'}</Text>
          </Pressable>
        </SettingsSheet>
      )}

      {/* Notifications Sheet */}
      {activeSheet === 'notifications' && (
        <SettingsSheet title="Notifications" onClose={closeSheet}>
          <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Push Notifications</Text>
          <Toggle label="Job Updates" description="When a contractor responds to your quote request" defaultOn />
          <Toggle label="New Messages" description="When you receive a new message" defaultOn />
          <Toggle label="Payment Status" description="When payment is confirmed or released" defaultOn />
          <Toggle label="New Reviews" description="When someone reviews your project" />
          <Toggle label="Promotions" description="Deals and offers from Ratedeed" />
          <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mt-4 mb-2">Email</Text>
          <Toggle label="Job Summary" description="Weekly digest of your active projects" defaultOn />
          <Toggle label="Marketing Emails" description="Tips, guides, and product updates" />
        </SettingsSheet>
      )}

      {/* Privacy & Security Sheet */}
      {activeSheet === 'privacy' && (
        <SettingsSheet title="Privacy & Security" onClose={closeSheet}>
          <Pressable onPress={() => { closeSheet(); setTimeout(() => setActiveSheet('change-password'), 300); }} className="flex-row items-center justify-between py-2">
            <View>
              <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50">Change Password</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Update your account password</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#a3a3a3" />
          </Pressable>
          <Pressable onPress={() => { closeSheet(); setTimeout(() => setActiveSheet('change-email'), 300); }} className="flex-row items-center justify-between py-2 mb-2">
            <View>
              <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50">Change Email</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Update your email address</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color="#a3a3a3" />
          </Pressable>
          <Toggle label="Two-Factor Authentication" description="Add an extra layer of security" />
          <Toggle label="Biometric Login" description="Use Face ID or fingerprint to log in" defaultOn />
          <View className="pt-2 border-t border-neutral-100 dark:border-neutral-800 mt-2">
            <Text className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Data & Privacy</Text>
            <Toggle label="Share Usage Data" description="Help us improve with anonymous usage data" defaultOn />
            <Toggle label="Location Services" description="Allow access to your location for nearby results" defaultOn />
          </View>
          <View className="pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-2">
            <Pressable><Text className="text-sm font-medium text-indigo-500">Delete Account</Text></Pressable>
            <Text className="text-[11px] text-neutral-400 mt-0.5">Permanently delete your account and all data</Text>
          </View>
        </SettingsSheet>
      )}

      
      {/* Change Email Sheet */}
      {activeSheet === 'change-email' && (
        <SettingsSheet title="Change Email" onClose={closeSheet}>
          {emailMessage && (
            <View className={`mb-4 px-3 py-2 rounded-lg ${emailMessage.type === 'success' ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
              <Text className={`text-sm ${emailMessage.type === 'success' ? 'text-emerald-700' : 'text-indigo-700'}`}>{emailMessage.text}</Text>
            </View>
          )}
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Current Email</Text>
          <TextInput value={user?.email} editable={false} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-500 bg-neutral-50 dark:bg-neutral-800" />
          
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">New Email</Text>
          <TextInput value={emailNew} onChangeText={setEmailNew} keyboardType="email-address" autoCapitalize="none" className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" placeholderTextColor="#a3a3a3" />
          
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Current Password</Text>
          <TextInput value={emailPassword} onChangeText={setEmailPassword} secureTextEntry className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" placeholderTextColor="#a3a3a3" />
          
          <Pressable onPress={handleChangeEmail} disabled={emailSaving} className="w-full py-3 bg-indigo-600 rounded-xl items-center flex-row justify-center mt-2" style={{ gap: 8 }}>
            {emailSaving && <ActivityIndicator size="small" color="#fff" />}
            <Text className="text-sm font-semibold text-white dark:text-neutral-900">{emailSaving ? 'Sending...' : 'Send Verification Email'}</Text>
          </Pressable>
          <Text className="text-xs text-neutral-400 text-center mt-3">
            We'll send a verification link to your new email.
          </Text>
        </SettingsSheet>
      )}
  
      {/* Change Password Sheet */}
      {activeSheet === 'change-password' && (
        <SettingsSheet title="Change Password" onClose={closeSheet}>
          {pwMessage && (
            <View className={`mb-4 px-3 py-2 rounded-lg ${pwMessage.type === 'success' ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
              <Text className={`text-sm ${pwMessage.type === 'success' ? 'text-emerald-700' : 'text-indigo-700'}`}>{pwMessage.text}</Text>
            </View>
          )}
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Current Password</Text>
          <TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" placeholderTextColor="#a3a3a3" />
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">New Password</Text>
          <TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-1 text-neutral-900 dark:text-neutral-50" placeholderTextColor="#a3a3a3" />
          <Text className="text-[11px] text-neutral-400 mb-3">Minimum 8 characters</Text>
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Confirm New Password</Text>
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" placeholderTextColor="#a3a3a3" />
          <Pressable onPress={handleChangePassword} disabled={pwSaving} className="w-full py-3 bg-indigo-600 rounded-xl items-center flex-row justify-center" style={{ gap: 8 }}>
            {pwSaving && <ActivityIndicator size="small" color="#fff" />}
            <Text className="text-sm font-semibold text-white dark:text-neutral-900">{pwSaving ? 'Updating...' : 'Change Password'}</Text>
          </Pressable>
        </SettingsSheet>
      )}

      {/* App Settings Sheet */}
      {activeSheet === 'settings' && (
        <SettingsSheet title="App Settings" onClose={closeSheet}>
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Language</Text>
          <View className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 flex-row items-center justify-between mb-3">
            <Text className="text-sm text-neutral-900 dark:text-neutral-50">English (US)</Text>
            <FontAwesome5 name="chevron-down" size={12} color="#a3a3a3" />
          </View>
          <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Default Service Area</Text>
          <TextInput defaultValue={user?.zipCode || '10001'} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3 text-neutral-900 dark:text-neutral-50" />
          <Toggle 
            label="Dark Mode" 
            description="Switch between light and dark themes" 
            defaultOn={colorScheme === 'dark'}
            onValueChange={(val) => setColorScheme(val ? 'dark' : 'light')} 
          />
          <Toggle label="Auto-play Videos" description="Play videos automatically when scrolling" defaultOn />
          <Toggle label="Haptic Feedback" description="Vibrate on button taps and interactions" defaultOn />
          <View className="pt-2 border-t border-neutral-100 dark:border-neutral-800 mt-2">
            <Text className="text-xs text-neutral-400">Version 1.0.0 · Build 2026.04</Text>
          </View>
        </SettingsSheet>
      )}

      {/* Help Center Sheet */}
      {activeSheet === 'help' && (
        <SettingsSheet title="Help Center" onClose={closeSheet}>
          {faqs.map((faq, i) => (
            <View key={i} className="border-b border-neutral-100 dark:border-neutral-800">
              <Pressable onPress={() => setOpenFaq(openFaq === i ? null : i)} className="flex-row items-center justify-between py-3">
                <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50 flex-1 mr-4">{faq.q}</Text>
                <FontAwesome5 name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={12} color="#a3a3a3" />
              </Pressable>
              {openFaq === i && <Text className="text-sm text-neutral-600 dark:text-neutral-400 leading-5 pb-3">{faq.a}</Text>}
            </View>
          ))}
          <View className="pt-4 border-t border-neutral-100 dark:border-neutral-800 mt-2 items-center">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">Still need help?</Text>
            <Pressable className="w-full py-3 border border-indigo-600 rounded-xl items-center">
              <Text className="text-sm font-semibold text-indigo-600">Contact Support</Text>
            </Pressable>
          </View>
        </SettingsSheet>
      )}
    </View>
  );
};

export default ProfileScreen;
