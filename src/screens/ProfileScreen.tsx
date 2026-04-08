import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Text,
  Image,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getUserProfile, updateUserProfile, changePassword, enable2FA, disable2FA } from '../api/user';
import { getUserReviews } from '../api/review';
import { getUserPosts } from '../api/post';
import { useAuth } from '../context/AuthContext';
import { Tabs, TabPanel } from '../components/common/Tabs';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors } from '../constants/designTokens';
import { User, Review, Post } from '../types';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'reviews', label: 'My Reviews' },
  { key: 'projects', label: 'Projects' },
  { key: 'settings', label: 'Settings' },
];

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { logout, firebaseUser: authUser } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  };

  if (loading && !user) {
    return (
      <View style={styles.fullScreenContainer}>
        <Header title="Profile" onBackPress={() => {}} rightComponent={null} />
        <View style={styles.loadingContainer}>
          <SkeletonLoader type="profile" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullScreenContainer}>
        <Header title="Profile" onBackPress={() => {}} rightComponent={null} />
        <ErrorState message={error} onRetry={loadProfile} />
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Profile" onBackPress={() => {}} rightComponent={null} />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TabPanel isActive={activeTab === 'overview'}>
          <View style={styles.tabContent}>
            <Card style={styles.profileHeader}>
              <View style={styles.bannerContainer}>
                <View style={styles.banner}>
                  {user?.bannerImage ? (
                    <Image source={{ uri: user.bannerImage }} style={styles.bannerImage} />
                  ) : (
                    <View style={[styles.bannerPlaceholder, { backgroundColor: Colors.primary300 }]} />
                  )}
                </View>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    {user?.profilePicture ? (
                      <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {user?.firstName} {user?.lastName}
                </Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                {user?.createdAt && (
                  <Text style={styles.joinDate}>Joined {formatDate(user.createdAt)}</Text>
                )}
              </View>
            </Card>

            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{reviews.length}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{projects.length}</Text>
                <Text style={styles.statLabel}>Projects</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{user?.referralPoints || 0}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </Card>
            </View>

            <Card style={styles.infoCard}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{user?.zipCode || 'Not set'}</Text>
              <Text style={[styles.infoLabel, { marginTop: Spacing.md }]}>Address</Text>
              <Text style={styles.infoValue}>{user?.address || 'Not set'}</Text>
            </Card>
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'reviews'}>
          <View style={styles.tabContent}>
            {reviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                message="Reviews you leave for contractors will appear here"
                icon="⭐"
              />
            ) : (
              reviews.map(review => (
                <Card key={review._id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewStars}>
                      <Text style={styles.stars}>{renderStars(review.rating)}</Text>
                    </View>
                    <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                  </View>
                  {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </Card>
              ))
            )}
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'projects'}>
          <View style={styles.tabContent}>
            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                message="Projects you share will appear here"
                icon="📋"
              />
            ) : (
              projects.map(post => (
                <Card key={post._id} style={styles.projectCard}>
                  <Text style={styles.projectCaption}>{post.caption}</Text>
                  {post.images?.length > 0 && (
                    <ScrollView horizontal style={styles.projectImages} showsHorizontalScrollIndicator={false}>
                      {post.images.map((img, idx) => (
                        <Image key={idx} source={{ uri: img }} style={styles.projectImage} />
                      ))}
                    </ScrollView>
                  )}
                  <Text style={styles.projectDate}>{formatDate(post.createdAt)}</Text>
                </Card>
              ))
            )}
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'settings'}>
          <View style={styles.tabContent}>
            <Card style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>Personal Information</Text>
              {isEditing ? (
                <>
                  <Input
                    label="First Name"
                    value={editableData.firstName}
                    onChangeText={text => setEditableData(prev => ({ ...prev, firstName: text }))}
                  />
                  <Input
                    label="Last Name"
                    value={editableData.lastName}
                    onChangeText={text => setEditableData(prev => ({ ...prev, lastName: text }))}
                  />
                  <Input
                    label="Email"
                    value={editableData.email}
                    onChangeText={text => setEditableData(prev => ({ ...prev, email: text }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Input
                    label="Zip Code"
                    value={editableData.zipCode}
                    onChangeText={text => setEditableData(prev => ({ ...prev, zipCode: text }))}
                    keyboardType="numeric"
                  />
                  <Input
                    label="Address"
                    value={editableData.address}
                    onChangeText={text => setEditableData(prev => ({ ...prev, address: text }))}
                  />
                  <View style={styles.buttonRow}>
                    <Button title="Save" onPress={handleSaveProfile} style={styles.saveButton} />
                    <Button
                      title="Cancel"
                      onPress={() => setIsEditing(false)}
                      style={styles.cancelButton}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name</Text>
                    <Text style={styles.infoValue}>{user?.firstName} {user?.lastName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{user?.email}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Zip Code</Text>
                    <Text style={styles.infoValue}>{user?.zipCode || 'Not set'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Address</Text>
                    <Text style={styles.infoValue}>{user?.address || 'Not set'}</Text>
                  </View>
                  <Button
                    title="Edit Profile"
                    onPress={() => setIsEditing(true)}
                    style={styles.editButton}
                  />
                </>
              )}
            </Card>

            <Card style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>Security</Text>
              <TouchableOpacity
                style={styles.settingOption}
                onPress={() => setShowChangePassword(!showChangePassword)}
              >
                <Text style={styles.settingOptionText}>Change Password</Text>
              </TouchableOpacity>
              {showChangePassword && (
                <View style={styles.passwordForm}>
                  <Input
                    label="Current Password"
                    secureTextEntry
                    value={passwords.current}
                    onChangeText={text => setPasswords(prev => ({ ...prev, current: text }))}
                  />
                  <Input
                    label="New Password"
                    secureTextEntry
                    value={passwords.new}
                    onChangeText={text => setPasswords(prev => ({ ...prev, new: text }))}
                  />
                  <Input
                    label="Confirm New Password"
                    secureTextEntry
                    value={passwords.confirm}
                    onChangeText={text => setPasswords(prev => ({ ...prev, confirm: text }))}
                  />
                  <Button title="Update Password" onPress={handleChangePassword} />
                </View>
              )}
              <TouchableOpacity style={styles.settingOption} onPress={handleToggle2FA}>
                <Text style={styles.settingOptionText}>
                  Two-Factor Authentication: {is2FAEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </TouchableOpacity>
            </Card>

            <Card style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>Account</Text>
              <TouchableOpacity
                style={styles.settingOption}
                onPress={() => navigation.navigate('ContractorSignup' as never)}
              >
                <Text style={styles.settingOptionText}>Become a Contractor</Text>
              </TouchableOpacity>
              <Button
                title="Log Out"
                onPress={handleLogout}
                style={styles.logoutButton}
              />
            </Card>
          </View>
        </TabPanel>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  loadingContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: Spacing.lg,
  },
  profileHeader: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  bannerContainer: {
    position: 'relative',
    height: 120,
  },
  banner: {
    height: 120,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -40,
    left: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary500,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: Colors.neutral50,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.neutral50,
  },
  profileInfo: {
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.neutral600,
    marginTop: 2,
  },
  joinDate: {
    fontSize: 12,
    color: Colors.neutral500,
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.neutral500,
    marginTop: 2,
  },
  infoCard: {
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.neutral500,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.neutral900,
    fontWeight: '500',
  },
  reviewCard: {
    marginBottom: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reviewStars: {},
  stars: {
    color: Colors.warning500,
    fontSize: 16,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.neutral500,
  },
  reviewTitle: {
    fontWeight: '600',
    color: Colors.neutral900,
    marginBottom: Spacing.xs,
  },
  reviewComment: {
    color: Colors.neutral700,
    lineHeight: 20,
  },
  projectCard: {
    marginBottom: Spacing.md,
  },
  projectCaption: {
    color: Colors.neutral800,
    marginBottom: Spacing.sm,
  },
  projectImages: {
    marginBottom: Spacing.sm,
  },
  projectImage: {
    width: 150,
    height: 100,
    borderRadius: Radii.md,
    marginRight: Spacing.sm,
  },
  projectDate: {
    fontSize: 12,
    color: Colors.neutral500,
  },
  settingsCard: {
    marginBottom: Spacing.lg,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral900,
    marginBottom: Spacing.md,
  },
  settingOption: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  settingOptionText: {
    fontSize: 15,
    color: Colors.primary500,
  },
  passwordForm: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  saveButton: {
    flex: 1,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.neutral500,
  },
  editButton: {
    marginTop: Spacing.md,
  },
  logoutButton: {
    backgroundColor: Colors.error500,
    marginTop: Spacing.md,
  },
});

export default ProfileScreen;
