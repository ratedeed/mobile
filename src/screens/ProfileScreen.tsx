import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Text,
  Image,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUserProfile, updateUserProfile, changePassword, enable2FA, disable2FA } from '../api/user';
import { getUserReviews } from '../api/review';
import { getUserPosts } from '../api/post';
import { useAuth } from '../context/AuthContext';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import { Modal } from '../components/common/Modal';
import { User, Review, Post } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';

type RootStackParamList = {
  Profile: undefined;
  ContractorDashboard: undefined;
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout, firebaseUser: authUser } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [projects, setProjects] = useState<Post[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    zipCode: '',
    address: '',
  });

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Bottom sheet states
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  // Notification toggles
  const [notifications, setNotifications] = useState({
    jobUpdates: true,
    newMessages: true,
    paymentStatus: true,
    newReviews: false,
    promotions: false,
    emailSummary: true,
    marketingEmails: false,
  });

  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      const userData = await getUserProfile();
      setUser(userData);
      setEditableData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        zipCode: userData.zipCode || '',
        address: userData.address || '',
      });
      setIs2FAEnabled((userData as any).is2FAEnabled || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadUserContent = useCallback(async () => {
    if (!user?._id) return;
    try {
      const [reviewsData, projectsData] = await Promise.all([
        getUserReviews(user._id).catch(() => []),
        getUserPosts(user._id).catch(() => ({ posts: [] })).then(r => r.posts || []),
      ]);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (err) {
      console.error('Failed to load user content:', err);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  useEffect(() => {
    if (user?._id) {
      loadUserContent();
    }
  }, [user?._id, loadUserContent]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const data = await updateUserProfile(editableData);
      setUser(data);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    try {
      await changePassword(passwords.current, passwords.new);
      Alert.alert('Success', 'Password changed successfully!');
      setPasswords({ current: '', new: '', confirm: '' });
      setShowChangePassword(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  const handleToggle2FA = async () => {
    try {
      if (is2FAEnabled) {
        await disable2FA('');
        setIs2FAEnabled(false);
      } else {
        await enable2FA();
        setIs2FAEnabled(true);
      }
      Alert.alert('Success', `2FA ${is2FAEnabled ? 'disabled' : 'enabled'}!`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to toggle 2FA');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            Alert.alert('Error', 'Failed to log out');
          }
        },
      },
    ]);
  };

  const stats = {
    reviews: reviews.length,
    conversations: 5, // Placeholder - would need API
    projects: projects.length,
  };

  if (loading && !user) {
    return (
      <View style={styles.container}>
        <Header title="Profile" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Profile" />
        <ErrorState message={error} onRetry={loadProfile} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Profile" />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - Reference Design */}
        <View style={styles.profileHeader}>
          <View style={styles.profileMain}>
            <View style={styles.avatarContainer}>
              {user?.profilePicture ? (
                <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  </Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.editAvatarButton}
                onPress={() => setActiveSheet('edit-profile')}
              >
                <FontAwesome5 name="edit" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <View style={styles.profileBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Homeowner</Text>
                </View>
                <View style={[styles.badge, styles.badgeSecondary]}>
                  <Text style={[styles.badgeText, styles.badgeTextSecondary]}>
                    Since {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2024'}
                  </Text>
                </View>
              </View>
              <Button
                title="Switch to Contractor Dashboard"
                onPress={() => navigation.navigate('ContractorDashboard')}
                style={styles.switchButton}
                textStyle={styles.switchButtonText}
              />
            </View>
          </View>
        </View>

        {/* Stats Section - Reference Design */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statValue}>{stats.reviews}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statValue}>{stats.conversations}</Text>
              <Text style={styles.statLabel}>Conversations</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem}>
              <Text style={styles.statValue}>{stats.projects}</Text>
              <Text style={styles.statLabel}>Projects</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Items - Reference Design */}
        <View style={styles.menuSection}>
          <MenuItem
            icon="user-edit"
            label="Edit Profile"
            description="Name, email, phone, photo"
            onPress={() => setActiveSheet('edit-profile')}
          />
          <MenuItem
            icon="bell"
            label="Notifications"
            description="Push, email, job updates"
            onPress={() => setActiveSheet('notifications')}
          />
          <MenuItem
            icon="shield-alt"
            label="Privacy & Security"
            description="Password, 2FA, data"
            onPress={() => setActiveSheet('privacy')}
          />
          <MenuItem
            icon="cog"
            label="App Settings"
            description="Theme, language, defaults"
            onPress={() => setActiveSheet('settings')}
          />
          <MenuItem
            icon="question-circle"
            label="Help Center"
            description="FAQs, support, contact"
            onPress={() => setActiveSheet('help')}
            isLast
          />
        </View>

        {/* Log Out */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <FontAwesome5 name="sign-out-alt" size={20} color="#f43f5e" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Profile Sheet */}
      <Modal
        visible={activeSheet === 'edit-profile'}
        onClose={() => setActiveSheet(null)}
        title="Edit Profile"
      >
        <View style={styles.sheetContent}>
          <View style={styles.sheetAvatarContainer}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.sheetAvatar} />
            ) : (
              <View style={styles.sheetAvatarPlaceholder}>
                <Text style={styles.sheetAvatarInitial}>
                  {(user?.firstName?.[0] || 'U').toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.sheetEditAvatarButton}>
              <FontAwesome5 name="edit" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Input
            label="First name"
            value={editableData.firstName}
            onChangeText={(text) => setEditableData({ ...editableData, firstName: text })}
            style={styles.sheetInput}
          />
          <Input
            label="Last name"
            value={editableData.lastName}
            onChangeText={(text) => setEditableData({ ...editableData, lastName: text })}
            style={styles.sheetInput}
          />
          <Input
            label="Email"
            value={editableData.email}
            onChangeText={(text) => setEditableData({ ...editableData, email: text })}
            autoCapitalize="none"
            style={styles.sheetInput}
          />
          <Input
            label="Phone"
            value={editableData.address || ''}
            onChangeText={(text) => setEditableData({ ...editableData, address: text })}
            keyboardType="phone-pad"
            style={styles.sheetInput}
          />
          <Input
            label="Zip code"
            value={editableData.zipCode}
            onChangeText={(text) => setEditableData({ ...editableData, zipCode: text })}
            keyboardType="numeric"
            style={styles.sheetInput}
          />
          <Button
            title="Save Changes"
            onPress={handleSaveProfile}
            style={styles.saveButton}
          />
        </View>
      </Modal>

      {/* Notifications Sheet */}
      <Modal
        visible={activeSheet === 'notifications'}
        onClose={() => setActiveSheet(null)}
        title="Notifications"
      >
        <View style={styles.sheetContent}>
          <Text style={styles.sectionLabel}>Push Notifications</Text>
          <ToggleRow
            label="Job Updates"
            description="When a contractor responds to your quote request"
            value={notifications.jobUpdates}
            onValueChange={(val) => setNotifications({ ...notifications, jobUpdates: val })}
          />
          <ToggleRow
            label="New Messages"
            description="When you receive a new message"
            value={notifications.newMessages}
            onValueChange={(val) => setNotifications({ ...notifications, newMessages: val })}
          />
          <ToggleRow
            label="Payment Status"
            description="When payment is confirmed or released"
            value={notifications.paymentStatus}
            onValueChange={(val) => setNotifications({ ...notifications, paymentStatus: val })}
          />
          <ToggleRow
            label="New Reviews"
            description="When someone reviews your project"
            value={notifications.newReviews}
            onValueChange={(val) => setNotifications({ ...notifications, newReviews: val })}
          />
          <ToggleRow
            label="Promotions"
            description="Deals and offers from Ratedeed"
            value={notifications.promotions}
            onValueChange={(val) => setNotifications({ ...notifications, promotions: val })}
          />
          
          <Text style={[styles.sectionLabel, styles.sectionLabelMargin]}>Email</Text>
          <ToggleRow
            label="Job Summary"
            description="Weekly digest of your active projects"
            value={notifications.emailSummary}
            onValueChange={(val) => setNotifications({ ...notifications, emailSummary: val })}
          />
          <ToggleRow
            label="Marketing Emails"
            description="Tips, guides, and product updates"
            value={notifications.marketingEmails}
            onValueChange={(val) => setNotifications({ ...notifications, marketingEmails: val })}
          />
        </View>
      </Modal>

      {/* Privacy & Security Sheet */}
      <Modal
        visible={activeSheet === 'privacy'}
        onClose={() => setActiveSheet(null)}
        title="Privacy &amp; Security"
      >
        <View style={styles.sheetContent}>
          <TouchableOpacity 
            style={styles.menuRow}
            onPress={() => setShowChangePassword(true)}
          >
            <View>
              <Text style={styles.menuRowLabel}>Change Password</Text>
              <Text style={styles.menuRowDescription}>Last changed 30 days ago</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
          
          <ToggleRow
            label="Two-Factor Authentication"
            description="Add an extra layer of security to your account"
            value={is2FAEnabled}
            onValueChange={handleToggle2FA}
          />
          <ToggleRow
            label="Biometric Login"
            description="Use Face ID or fingerprint to log in"
            value={false}
            onValueChange={() => {}}
          />
          
          <Text style={[styles.sectionLabel, styles.sectionLabelMargin]}>Data & Privacy</Text>
          <ToggleRow
            label="Share Usage Data"
            description="Help us improve Ratedeed with anonymous usage data"
            value={true}
            onValueChange={() => {}}
          />
          <ToggleRow
            label="Location Services"
            description="Allow access to your location for nearby results"
            value={true}
            onValueChange={() => {}}
          />
        </View>
      </Modal>

      {/* App Settings Sheet */}
      <Modal
        visible={activeSheet === 'settings'}
        onClose={() => setActiveSheet(null)}
        title="App Settings"
      >
        <View style={styles.sheetContent}>
          <TouchableOpacity style={styles.menuRow}>
            <View>
              <Text style={styles.menuRowLabel}>Theme</Text>
              <Text style={styles.menuRowDescription}>System default</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <View>
              <Text style={styles.menuRowLabel}>Language</Text>
              <Text style={styles.menuRowDescription}>English</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <View>
              <Text style={styles.menuRowLabel}>Default Search Location</Text>
              <Text style={styles.menuRowDescription}>{user?.zipCode || 'Not set'}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Help Center Sheet */}
      <Modal
        visible={activeSheet === 'help'}
        onClose={() => setActiveSheet(null)}
        title="Help Center"
      >
        <View style={styles.sheetContent}>
          <TouchableOpacity style={styles.menuRow}>
            <FontAwesome5 name="book" size={20} color="#6b7280" />
            <Text style={[styles.menuRowLabel, styles.menuRowLabelMargin]}>FAQs</Text>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <FontAwesome5 name="headset" size={20} color="#6b7280" />
            <Text style={[styles.menuRowLabel, styles.menuRowLabelMargin]}>Contact Support</Text>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <FontAwesome5 name="info-circle" size={20} color="#6b7280" />
            <Text style={[styles.menuRowLabel, styles.menuRowLabelMargin]}>About Ratedeed</Text>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuRow}>
            <FontAwesome5 name="file-alt" size={20} color="#6b7280" />
            <Text style={[styles.menuRowLabel, styles.menuRowLabelMargin]}>Terms of Service</Text>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuRow, styles.menuRowBorderNone]}>
            <FontAwesome5 name="shield-alt" size={20} color="#6b7280" />
            <Text style={[styles.menuRowLabel, styles.menuRowLabelMargin]}>Privacy Policy</Text>
            <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        title="Change Password"
      >
        <View style={styles.sheetContent}>
          <Input
            label="Current Password"
            value={passwords.current}
            onChangeText={(text) => setPasswords({ ...passwords, current: text })}
            secureTextEntry
            style={styles.sheetInput}
          />
          <Input
            label="New Password"
            value={passwords.new}
            onChangeText={(text) => setPasswords({ ...passwords, new: text })}
            secureTextEntry
            style={styles.sheetInput}
          />
          <Input
            label="Confirm New Password"
            value={passwords.confirm}
            onChangeText={(text) => setPasswords({ ...passwords, confirm: text })}
            secureTextEntry
            style={styles.sheetInput}
          />
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setShowChangePassword(false)}
              style={styles.modalButton}
            />
            <Button
              title="Change Password"
              onPress={handleChangePassword}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Menu Item Component
function MenuItem({ 
  icon, 
  label, 
  description, 
  onPress, 
  isLast = false 
}: { 
  icon: string; 
  label: string; 
  description: string; 
  onPress: () => void; 
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity 
      style={[styles.menuItem, !isLast && styles.menuItemBorder]} 
      onPress={onPress}
    >
      <FontAwesome5 name={icon as any} size={20} color="#374151" />
      <View style={styles.menuItemContent}>
        <Text style={styles.menuItemLabel}>{label}</Text>
        <Text style={styles.menuItemDescription}>{description}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={16} color="#9ca3af" />
    </TouchableOpacity>
  );
}

// Toggle Row Component
function ToggleRow({ 
  label, 
  description, 
  value, 
  onValueChange 
}: { 
  label: string; 
  description: string; 
  value: boolean; 
  onValueChange: (val: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleRowContent}>
        <Text style={styles.toggleRowLabel}>{label}</Text>
        <Text style={styles.toggleRowDescription}>{description}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.toggle, value && styles.toggleActive]}
        onPress={() => onValueChange(!value)}
      >
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  // Profile Header
  profileHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeSecondary: {
    backgroundColor: '#f3f4f6',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  badgeTextSecondary: {
    color: '#374151',
  },
  switchButton: {
    backgroundColor: '#111827',
    marginTop: 12,
    paddingVertical: 10,
  },
  switchButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Stats Section
  statsSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e5e7eb',
  },
  // Menu Section
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  menuItemDescription: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f43f5e',
  },
  bottomSpacer: {
    height: 32,
  },
  // Sheet Content
  sheetContent: {
    paddingBottom: 20,
  },
  sheetAvatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  sheetAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetAvatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetEditAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '50%',
    marginRight: -16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sheetInput: {
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
  },
  // Section Label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionLabelMargin: {
    marginTop: 20,
  },
  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  toggleRowContent: {
    flex: 1,
    marginRight: 16,
  },
  toggleRowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  toggleRowDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#4F46E5',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  // Menu Row
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  menuRowBorderNone: {
    borderBottomWidth: 0,
  },
  menuRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  menuRowLabelMargin: {
    marginLeft: 0,
  },
  menuRowDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  // Modal Buttons
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
  },
});

export default ProfileScreen;
