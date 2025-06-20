import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchUserProfile, updateUserProfile, changePassword, toggleTwoFactorAuth } from '../api/user';
import { useAuth } from '../context/AuthContext';
// Removed direct firebase auth imports as we will use context's logout
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [editableEmail, setEditableEmail] = useState('');
  const [editableZipCode, setEditableZipCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false); // Assuming initial state from backend
  const { logout } = useAuth(); // Get logout function from AuthContext
 
   // Dummy user ID and token for demonstration. In a real app, these would come from auth context/storage.
   useFocusEffect(
     React.useCallback(() => {
       loadUserProfile();
     }, [])
   );

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const userData = await fetchUserProfile();
      console.log('Fetched user data:', userData);
      setUser(userData);
      setEditableName(`${userData.firstName || ''} ${userData.lastName || ''}`.trim());
      setEditableEmail(userData.email);
      setEditableZipCode(userData.zipCode || '');
      setIs2FAEnabled(userData.is2FAEnabled || false);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load profile.');
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const [firstName, ...lastNameParts] = editableName.split(' ');
      const lastName = lastNameParts.join(' ');

      const updatedProfile = {
        firstName: firstName,
        lastName: lastName,
        email: editableEmail,
        zipCode: editableZipCode,
      };
      console.log('Sending profile data:', updatedProfile);
      const data = await updateUserProfile(updatedProfile);
      setUser(data);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
      console.error('Save profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset editable fields to current user data
    if (user) {
      setEditableName(`${user.firstName || ''} ${user.lastName || ''}`.trim());
      setEditableEmail(user.email);
      setEditableZipCode(user.zipCode || '');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to change password.');
      console.error('Change password error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    setLoading(true);
    try {
      const new2FAStatus = !is2FAEnabled;
      await toggleTwoFactorAuth(new2FAStatus);
      setIs2FAEnabled(new2FAStatus);
      Alert.alert('Success', `Two-Factor Authentication ${new2FAStatus ? 'enabled' : 'disabled'}!`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to toggle 2FA.');
      console.error('Toggle 2FA error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          onPress: async () => {
            try {
              console.log('ProfileScreen: Calling AuthContext logout function...');
              await logout(); // Use the logout function from AuthContext
              console.log('ProfileScreen: AuthContext logout function called successfully.');
              // App.js will automatically switch to AuthNavigator due to AuthContext change
            } catch (error) {
              console.error('ProfileScreen: Error during logout:', error);
              Alert.alert('Logout Error', error.message || 'Failed to log out.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary500} />
        <Typography variant="body" style={styles.loadingText}>Loading profile...</Typography>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Account Settings" />
      <ScrollView contentContainerStyle={styles.container}>
        <Typography variant="h3" style={styles.title}>Account Settings</Typography>
        <Typography variant="subtitle1" style={styles.subtitle}>Manage your personal information and preferences.</Typography>
        
        <Card style={styles.section}>
          <Typography variant="h5" style={styles.sectionTitle}>Profile Information</Typography>
          {isEditing ? (
            <>
              <Input
                label="Name"
                value={editableName}
                onChangeText={setEditableName}
                style={styles.inputField}
              />
              <Input
                label="Email"
                value={editableEmail}
                onChangeText={setEditableEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.inputField}
              />
              <Input
                label="Zip Code"
                value={editableZipCode}
                onChangeText={setEditableZipCode}
                keyboardType="numeric"
                style={styles.inputField}
              />
              <View style={styles.buttonRow}>
                <Button
                  title="Save Changes"
                  onPress={handleSaveProfile}
                  style={styles.saveButton}
                />
                <Button
                  title="Cancel"
                  onPress={handleCancelEdit}
                  style={styles.cancelButton}
                />
              </View>
            </>
          ) : (
            <>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Name:</Typography> {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Email:</Typography> {user?.email || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Zip Code:</Typography> {user?.zipCode || 'N/A'}</Typography>
              <Button
                title="Edit Profile"
                onPress={handleEditProfile}
                style={styles.editButton}
              />
            </>
          )}
        </Card>

        <Card style={styles.section}>
          <Typography variant="h5" style={styles.sectionTitle}>Security</Typography>
          <TouchableOpacity style={styles.optionButton} onPress={() => setShowChangePassword(!showChangePassword)}>
            <Typography variant="button" style={styles.optionButtonText}>Change Password</Typography>
          </TouchableOpacity>
          {showChangePassword && (
            <Card style={styles.changePasswordContainer}>
              <Input
                label="Current Password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={styles.inputField}
              />
              <Input
                label="New Password"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.inputField}
              />
              <Input
                label="Confirm New Password"
                secureTextEntry
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                style={styles.inputField}
              />
              <Button
                title="Submit Change"
                onPress={handleChangePassword}
                style={styles.submitPasswordChangeButton}
              />
            </Card>
          )}
          <TouchableOpacity style={styles.optionButton} onPress={handleToggle2FA}>
            <Typography variant="button" style={styles.optionButtonText}>Two-Factor Authentication: {is2FAEnabled ? 'Enabled' : 'Disabled'}</Typography>
          </TouchableOpacity>
        </Card>

        <Card style={styles.section}>
          <Typography variant="h5" style={styles.sectionTitle}>Account Actions</Typography>
          <TouchableOpacity style={styles.optionButton} onPress={() => navigation.navigate('ContractorSignup')}>
            <Typography variant="button" style={styles.optionButtonText}>Become a Contractor</Typography>
          </TouchableOpacity>
          <Button
            title="Log Out"
            onPress={handleLogout}
            style={styles.logoutButton}
          />
        </Card>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  loadingText: {
    marginTop: Spacing.sm,
    color: Colors.neutral600,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  title: {
    color: Colors.neutral900,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.neutral600,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.md,
  },
  infoText: {
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  inputField: {
    marginBottom: Spacing.md,
  },
  editButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  optionButton: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  optionButtonText: {
    color: Colors.primary500,
  },
  logoutButton: {
    backgroundColor: Colors.error,
    marginTop: Spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  saveButton: {
    backgroundColor: Colors.success,
    flex: 1,
    marginRight: Spacing.sm,
  },
  cancelButton: {
    backgroundColor: Colors.error,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  changePasswordContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.neutral100,
  },
  submitPasswordChangeButton: {
    marginTop: Spacing.md,
  },
});

export default ProfileScreen;