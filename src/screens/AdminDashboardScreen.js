import React from 'react';
import { View, ScrollView } from 'react-native';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { Spacing, Colors, Shadows } from '../constants/designTokens';
// import Footer from '../components/Footer'; // Assuming Footer will be updated or removed later

const AdminDashboardScreen = () => {
  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Admin Dashboard" />
      <ScrollView contentContainerClassName="flex-grow px-4 py-8">
        <Typography variant="h3" style={styles.title}>Admin Dashboard</Typography>
        <Typography variant="subtitle1" style={styles.subtitle}>Manage users, contractors, and content.</Typography>
        
        <Card style={styles.cardContainer}>
          <Typography variant="h5" style={styles.cardTitle}>User Management</Typography>
          <Typography variant="body" style={styles.mutedText}>View and manage user accounts, roles, and permissions.</Typography>
          {/* Add user management components here */}
        </Card>

        <Card style={styles.cardContainer}>
          <Typography variant="h5" style={styles.cardTitle}>Contractor Management</Typography>
          <Typography variant="body" style={styles.mutedText}>Approve, suspend, or manage contractor profiles and listings.</Typography>
          {/* Add contractor management components here */}
        </Card>

        <Card style={styles.cardContainer}>
          <Typography variant="h5" style={styles.cardTitle}>Content Moderation</Typography>
          <Typography variant="body" style={styles.mutedText}>Review and moderate user-generated content, such as reviews and posts.</Typography>
          {/* Add content moderation components here */}
        </Card>

        <Card style={styles.cardContainer}>
          <Typography variant="h5" style={styles.cardTitle}>Reports & Analytics</Typography>
          <Typography variant="body" style={styles.mutedText}>Access system reports and analytics for insights into app usage.</Typography>
          {/* Add reports/analytics components here */}
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
    marginBottom: Spacing.sm,
  },
  sectionText: {
    color: Colors.neutral700,
  },
});

export default AdminDashboardScreen;