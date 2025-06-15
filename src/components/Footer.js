import React from 'react';
import React from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../../constants/designTokens';

const Footer = () => {
  const navigation = useNavigation();

  const handleNewsletterSubscribe = () => {
    Alert.alert('Subscribe', 'Newsletter subscription functionality to be implemented.');
  };

  return (
    <View style={styles.footer}>
      <View style={styles.footerContent}>
        <View style={styles.footerSection}>
          <Typography variant="h6" style={styles.sectionTitle}>Company</Typography>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to About Us')}>
            <Typography variant="body" style={styles.link}>About Us</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Careers')}>
            <Typography variant="body" style={styles.link}>Careers</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Press')}>
            <Typography variant="body" style={styles.link}>Press</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Blog')}>
            <Typography variant="body" style={styles.link}>Blog</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSection}>
          <Typography variant="h6" style={styles.sectionTitle}>Resources</Typography>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Help Center')}>
            <Typography variant="body" style={styles.link}>Help Center</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Contractor Resources')}>
            <Typography variant="body" style={styles.link}>Contractor Resources</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Safety Tips')}>
            <Typography variant="body" style={styles.link}>Safety Tips</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Community')}>
            <Typography variant="body" style={styles.link}>Community</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSection}>
          <Typography variant="h6" style={styles.sectionTitle}>Legal</Typography>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Terms of Service')}>
            <Typography variant="body" style={styles.link}>Terms of Service</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Privacy Policy')}>
            <Typography variant="body" style={styles.link}>Privacy Policy</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to Cookie Policy')}>
            <Typography variant="body" style={styles.link}>Cookie Policy</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Navigation', 'Navigate to GDPR')}>
            <Typography variant="body" style={styles.link}>GDPR</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSection}>
          <Typography variant="h6" style={styles.sectionTitle}>Connect With Us</Typography>
          <View style={styles.socialIcons}>
            <TouchableOpacity onPress={() => Alert.alert('Social', 'Open Facebook')}>
              <FontAwesome5 name="facebook-f" size={Spacing.lg} color={Colors.neutral400} style={styles.socialIcon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Social', 'Open Twitter')}>
              <FontAwesome5 name="twitter" size={Spacing.lg} color={Colors.neutral400} style={styles.socialIcon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Social', 'Open Instagram')}>
              <FontAwesome5 name="instagram" size={Spacing.lg} color={Colors.neutral400} style={styles.socialIcon} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Social', 'Open LinkedIn')}>
              <FontAwesome5 name="linkedin-in" size={Spacing.lg} color={Colors.neutral400} style={styles.socialIcon} />
            </TouchableOpacity>
          </View>
          <Typography variant="body" style={styles.newsletterText}>Subscribe to our newsletter</Typography>
          <View style={styles.newsletterInputContainer}>
            <TextInput
              style={styles.newsletterInput}
              placeholder="Your email"
              placeholderTextColor={Colors.neutral500}
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.newsletterButton} onPress={handleNewsletterSubscribe}>
              <FontAwesome5 name="paper-plane" size={Spacing.md} color={Colors.neutral50} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.copyrightContainer}>
        <View style={styles.logoContainer}>
          <FontAwesome5 name="hammer" size={Spacing.xl} color={Colors.primary500} style={styles.logoIcon} />
          <Typography variant="h5" style={styles.logoText}>Ratedeed</Typography>
        </View>
        <Typography variant="caption" style={styles.copyrightText}>© {new Date().getFullYear()} Ratedeed. All rights reserved.</Typography>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: Colors.neutral900,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    ...Shadows.xl,
  },
  footerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxl,
  },
  footerSection: {
    width: '47%',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.neutral50,
    marginBottom: Spacing.md,
  },
  link: {
    color: Colors.neutral300,
    marginBottom: Spacing.xs,
  },
  socialIcons: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  socialIcon: {
    marginRight: Spacing.lg,
  },
  newsletterText: {
    color: Colors.neutral300,
    marginBottom: Spacing.sm,
  },
  newsletterInputContainer: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  newsletterInput: {
    flex: 1,
    backgroundColor: Colors.neutral800,
    color: Colors.neutral50,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    fontSize: 15,
    ...Shadows.xs,
  },
  newsletterButton: {
    backgroundColor: Colors.primary500,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.md,
    marginLeft: Spacing.sm,
    ...Shadows.md,
  },
  copyrightContainer: {
    borderTopWidth: 0,
    paddingTop: Spacing.xl,
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoIcon: {
    marginRight: Spacing.xs,
  },
  logoText: {
    color: Colors.primary500,
    letterSpacing: 0.5,
  },
  copyrightText: {
    color: Colors.neutral300,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});

export default Footer;