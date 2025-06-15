import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { fetchContractorDetails, updateContractorProfile } from '../api/contractor';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
// import Footer from '../components/Footer'; // Assuming Footer will be updated or removed later

const ContractorDashboardScreen = () => {
  const [contractor, setContractor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editableBio, setEditableBio] = useState('');
  const [editableYearsInBusiness, setEditableYearsInBusiness] = useState('');
  const [editableCertifications, setEditableCertifications] = useState('');
  const [editablePricing, setEditablePricing] = useState('');
  const [editableAreasServed, setEditableAreasServed] = useState('');
  const [editableServices, setEditableServices] = useState('');
  const [editablePhone, setEditablePhone] = useState('');
  const [editableEmail, setEditableEmail] = useState('');
  const [editableWebsite, setEditableWebsite] = useState('');
  const [editableAddress, setEditableAddress] = useState('');

  // Dummy contractor ID and token for demonstration. In a real app, these would come from auth context/storage.
  const DUMMY_CONTRACTOR_ID = 'contractor123';
  const DUMMY_AUTH_TOKEN = 'your_contractor_auth_token_here';

  useEffect(() => {
    loadContractorProfile();
  }, []);

  const loadContractorProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchContractorDetails(DUMMY_CONTRACTOR_ID);
      setContractor(data);
      setEditableBio(data.bio || '');
      setEditableYearsInBusiness(data.yearsInBusiness?.toString() || '');
      setEditableCertifications(data.certifications || '');
      setEditablePricing(data.pricing || '');
      setEditableAreasServed(data.areasServed || '');
      setEditableServices(data.services?.join(', ') || '');
      setEditablePhone(data.contact?.phone || '');
      setEditableEmail(data.contact?.email || '');
      setEditableWebsite(data.contact?.website || '');
      setEditableAddress(data.contact?.address || '');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load contractor profile.');
      console.error('Load contractor profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const updatedProfile = {
        bio: editableBio,
        yearsInBusiness: parseInt(editableYearsInBusiness) || null,
        certifications: editableCertifications,
        pricing: editablePricing,
        areasServed: editableAreasServed,
        services: editableServices.split(',').map(s => s.trim()).filter(s => s),
        contact: {
          phone: editablePhone,
          email: editableEmail,
          website: editableWebsite,
          address: editableAddress,
        },
      };
      const data = await updateContractorProfile(DUMMY_CONTRACTOR_ID, DUMMY_AUTH_TOKEN, updatedProfile);
      setContractor(data);
      setIsEditingProfile(false);
      Alert.alert('Success', 'Contractor profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update contractor profile.');
      console.error('Save contractor profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    if (contractor) {
      setEditableBio(contractor.bio || '');
      setEditableYearsInBusiness(contractor.yearsInBusiness?.toString() || '');
      setEditableCertifications(contractor.certifications || '');
      setEditablePricing(contractor.pricing || '');
      setEditableAreasServed(contractor.areasServed || '');
      setEditableServices(contractor.services?.join(', ') || '');
      setEditablePhone(contractor.contact?.phone || '');
      setEditableEmail(contractor.contact?.email || '');
      setEditableWebsite(contractor.contact?.website || '');
      setEditableAddress(contractor.contact?.address || '');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary500} />
        <Typography variant="body" style={styles.loadingText}>Loading dashboard...</Typography>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Contractor Dashboard" />
      <ScrollView contentContainerStyle={styles.container}>
        <Typography variant="h3" style={styles.title}>Contractor Dashboard</Typography>
        <Typography variant="subtitle1" style={styles.subtitle}>Manage your profile, services, and reviews.</Typography>

        <Card style={styles.section}>
          <Typography variant="h5" style={styles.sectionTitle}>Business Profile</Typography>
          {isEditingProfile ? (
            <>
              <Input
                label="Bio"
                style={styles.textArea}
                multiline
                numberOfLines={4}
                value={editableBio}
                onChangeText={setEditableBio}
              />
              <Input
                label="Years in Business"
                keyboardType="numeric"
                value={editableYearsInBusiness}
                onChangeText={setEditableYearsInBusiness}
              />
              <Input
                label="Certifications"
                value={editableCertifications}
                onChangeText={setEditableCertifications}
              />
              <Input
                label="Pricing"
                value={editablePricing}
                onChangeText={setEditablePricing}
              />
              <Input
                label="Areas Served"
                value={editableAreasServed}
                onChangeText={setEditableAreasServed}
              />
              <Input
                label="Services (comma-separated)"
                style={styles.textArea}
                multiline
                numberOfLines={3}
                value={editableServices}
                onChangeText={setEditableServices}
              />
              <Input
                label="Phone"
                keyboardType="phone-pad"
                value={editablePhone}
                onChangeText={setEditablePhone}
              />
              <Input
                label="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={editableEmail}
                onChangeText={setEditableEmail}
              />
              <Input
                label="Website"
                autoCapitalize="none"
                value={editableWebsite}
                onChangeText={setEditableWebsite}
              />
              <Input
                label="Address"
                value={editableAddress}
                onChangeText={setEditableAddress}
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
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Business Name:</Typography> {contractor?.name || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Bio:</Typography> {contractor?.bio || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Years in Business:</Typography> {contractor?.yearsInBusiness || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Certifications:</Typography> {contractor?.certifications || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Pricing:</Typography> {contractor?.pricing || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Areas Served:</Typography> {contractor?.areasServed || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Services:</Typography> {contractor?.services?.join(', ') || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Phone:</Typography> {contractor?.contact?.phone || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Email:</Typography> {contractor?.contact?.email || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Website:</Typography> {contractor?.contact?.website || 'N/A'}</Typography>
              <Typography variant="body" style={styles.infoText}><Typography variant="label">Address:</Typography> {contractor?.contact?.address || 'N/A'}</Typography>
              <Button
                title="Edit Profile"
                onPress={handleEditProfile}
                style={styles.editButton}
              />
            </>
          )}
        </Card>

        <Card style={styles.section}>
          <Typography variant="h5" style={styles.sectionTitle}>Reviews Received</Typography>
          {contractor?.reviewsList && contractor.reviewsList.length > 0 ? (
            contractor.reviewsList.map((review, index) => (
              <Card key={index} style={styles.reviewCard}>
                <Typography variant="h6" style={styles.reviewUser}>{review.user}</Typography>
                <Typography variant="subtitle2" style={styles.reviewTitle}>{review.title}</Typography>
                <Typography variant="body" style={styles.reviewComment}>{review.comment}</Typography>
                <Typography variant="caption" style={styles.reviewDate}>{review.date}</Typography>
              </Card>
            ))
          ) : (
            <Typography variant="body" style={styles.noContentText}>No reviews yet.</Typography>
          )}
        </Card>

        {/* Add sections for Portfolio Management, Post Management etc. */}
        <Card style={styles.section}>
          <Typography variant="h5" style={styles.sectionTitle}>Portfolio Management</Typography>
          <Typography variant="body" style={styles.noContentText}>Coming Soon: Manage your project portfolio here.</Typography>
          {/* Future implementation: Add image upload, reorder, delete */}
        </Card>

        <Card style={styles.section}>
          <Typography variant="h5" style={styles.sectionTitle}>Community Posts</Typography>
          <Typography variant="body" style={styles.noContentText}>Coming Soon: Create and manage your community posts.</Typography>
          {/* Future implementation: Add post creation, editing, deletion */}
        </Card>

      </ScrollView>
      {/* <Footer /> */}
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
  infoLabel: {
    fontWeight: '700',
    color: Colors.neutral800,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm,
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
  reviewCard: {
    backgroundColor: Colors.neutral100,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  reviewUser: {
    color: Colors.neutral900,
    marginBottom: Spacing.xxs,
  },
  reviewTitle: {
    color: Colors.neutral800,
    marginBottom: Spacing.xs,
  },
  reviewComment: {
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  reviewDate: {
    color: Colors.neutral500,
    textAlign: 'right',
  },
  noContentText: {
    color: Colors.neutral600,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});

export default ContractorDashboardScreen;