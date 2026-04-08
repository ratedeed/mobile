const fs = require('fs');
const path = './src/screens/BusinessDetailScreen.tsx';

let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(
  "import {\n  View,\n  StyleSheet,\n  ScrollView,\n  Image,\n  TouchableOpacity,\n  ActivityIndicator,\n  Alert,\n  RefreshControl,\n} from 'react-native';",
  "import {\n  View,\n  StyleSheet,\n  ScrollView,\n  Image,\n  TouchableOpacity,\n  ActivityIndicator,\n  Alert,\n  RefreshControl,\n  Share,\n  Linking,\n  Platform,\n} from 'react-native';"
);

// Add createLead to imports
content = content.replace(
  "import { fetchContractorDetails, submitReview, fetchContractorPosts } from '../api';",
  "import { fetchContractorDetails, submitReview, fetchContractorPosts, createLead } from '../api';"
);

// Add Modal import
content = content.replace(
  "import { Tabs, TabPanel } from '../components/common/Tabs';",
  "import { Tabs, TabPanel } from '../components/common/Tabs';\nimport { Modal } from '../components/common/Modal';"
);

// Add states for Quote Modal inside the component
const statesMatch = `const [activeTab, setActiveTab] = useState('about');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);`;

const newStates = `${statesMatch}
  const [isQuoteModalVisible, setIsQuoteModalVisible] = useState(false);
  const [quoteProjectTitle, setQuoteProjectTitle] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [quoteContactPreference, setQuoteContactPreference] = useState('email');`;

content = content.replace(statesMatch, newStates);

// Action handlers
const handlersInsertionPoint = "const loadContractorDetails = async () => {";
const actionHandlers = `
  const handleCall = () => {
    const phone = contractor?.contactInfo?.phoneNumber;
    if (phone) Linking.openURL(\`tel:\${phone}\`);
    else Alert.alert('Notice', 'Phone number not available');
  };

  const handleDirections = () => {
    const address = [contractor?.contactInfo?.address, contractor?.contactInfo?.city, contractor?.contactInfo?.state, contractor?.contactInfo?.zipCode].filter(Boolean).join(', ');
    if (address) {
      const url = Platform.select({
        ios: \`maps:0,0?q=\${encodeURIComponent(address)}\`,
        android: \`geo:0,0?q=\${encodeURIComponent(address)}\`
      });
      Linking.openURL(url as string);
    } else {
      Alert.alert('Notice', 'Address not available');
    }
  };

  const handleWebsite = () => {
    const website = contractor?.website;
    if (website) {
      const url = website.startsWith('http') ? website : \`https://\${website}\`;
      Linking.openURL(url);
    } else {
      Alert.alert('Notice', 'Website not available');
    }
  };

  const handleShare = async () => {
    try {
      const state = contractor?.contactInfo?.state?.toLowerCase() || 'usa';
      const zip = contractor?.contactInfo?.zipCode || '00000';
      const slug = contractor?.slug || contractor?._id;
      const url = \`https://ratedeed.com/contractor/\${state}/\${zip}/\${slug}\`;
      await Share.share({
        message: \`Check out \${contractor?.companyName} on RateDeed! \${url}\`,
        url: url,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleRequestQuote = async () => {
    if (!quoteProjectTitle.trim() || !quoteDescription.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      await createLead({
        contractorId: id,
        projectTitle: quoteProjectTitle,
        description: quoteDescription,
        contactPreference: quoteContactPreference
      });
      Alert.alert('Success', 'Your quote request has been sent!');
      setIsQuoteModalVisible(false);
      setQuoteProjectTitle('');
      setQuoteDescription('');
      setQuoteContactPreference('email');
    } catch (error) {
      Alert.alert('Error', 'Failed to send quote request');
    }
  };

  `;

content = content.replace(handlersInsertionPoint, actionHandlers + handlersInsertionPoint);

// Replace button in renderHeaderSection
const oldButton = `<Button
          title="Contact Contractor"
          onPress={() => navigation.navigate('ChatScreen', {
            recipientId: contractor?.user?._id,
            recipientName: contractor?.companyName,
          })}
          style={styles.contactButton}
        />`;

const newButtons = `<View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleCall}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="phone" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Call</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleDirections}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="directions" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Directions</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleWebsite}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="globe" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Website</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleShare}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="share" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Share</Typography>
          </TouchableOpacity>
        </View>
        <View style={styles.mainActionButtonsRow}>
          <Button
            title="Message"
            variant="outline"
            onPress={() => navigation.navigate('ChatScreen', {
              recipientId: contractor?.user?._id,
              recipientName: contractor?.companyName,
            })}
            style={styles.halfButton}
          />
          <Button
            title="Request Quote"
            onPress={() => setIsQuoteModalVisible(true)}
            style={styles.halfButton}
          />
        </View>`;

content = content.replace(oldButton, newButtons);

// Add Modal in return
const oldReturn = `    <View style={styles.container}>
      <Header title={contractor.companyName || 'Business Profile'} showBackButton onBackPress={() => navigation.goBack()} rightComponent={null} />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'about' && renderAboutTab()}
        {activeTab === 'services' && renderServicesTab()}
        {activeTab === 'portfolio' && renderPortfolioTab()}
        {activeTab === 'posts' && renderPostsTab()}
        {activeTab === 'reviews' && renderReviewsTab()}
      </ScrollView>
    </View>`;

const quoteModal = `      <Modal
        visible={isQuoteModalVisible}
        onClose={() => setIsQuoteModalVisible(false)}
        title="Request a Quote"
      >
        <Typography variant="body" style={styles.modalSubtitle}>
          Tell the contractor about your project to get an accurate estimate.
        </Typography>
        <Input
          label="Project Title"
          placeholder="e.g., Bathroom Remodel"
          value={quoteProjectTitle}
          onChangeText={setQuoteProjectTitle}
          style={styles.inputField}
        />
        <Input
          label="Description"
          placeholder="Describe your project details..."
          multiline
          numberOfLines={4}
          value={quoteDescription}
          onChangeText={setQuoteDescription}
          style={[styles.inputField, styles.textArea]}
        />
        <Typography variant="label" style={styles.contactPrefLabel}>Contact Preference</Typography>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={[styles.radioItem, quoteContactPreference === 'email' && styles.radioItemSelected]}
            onPress={() => setQuoteContactPreference('email')}
          >
            <Typography variant="body" style={quoteContactPreference === 'email' ? styles.radioTextSelected : styles.radioText}>Email</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioItem, quoteContactPreference === 'phone' && styles.radioItemSelected]}
            onPress={() => setQuoteContactPreference('phone')}
          >
            <Typography variant="body" style={quoteContactPreference === 'phone' ? styles.radioTextSelected : styles.radioText}>Phone</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioItem, quoteContactPreference === 'in_app' && styles.radioItemSelected]}
            onPress={() => setQuoteContactPreference('in_app')}
          >
            <Typography variant="body" style={quoteContactPreference === 'in_app' ? styles.radioTextSelected : styles.radioText}>In App Chat</Typography>
          </TouchableOpacity>
        </View>
        <Button
          title="Send Request"
          onPress={handleRequestQuote}
          style={styles.modalSubmitButton}
        />
      </Modal>`;

const newReturn = `    <View style={styles.container}>
      <Header title={contractor.companyName || 'Business Profile'} showBackButton onBackPress={() => navigation.goBack()} rightComponent={null} />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'about' && renderAboutTab()}
        {activeTab === 'services' && renderServicesTab()}
        {activeTab === 'portfolio' && renderPortfolioTab()}
        {activeTab === 'posts' && renderPostsTab()}
        {activeTab === 'reviews' && renderReviewsTab()}
      </ScrollView>
${quoteModal}
    </View>`;

content = content.replace(oldReturn, newReturn);

// Add styles
const newStyles = `
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  actionIconButton: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxs,
  },
  actionIconText: {
    color: Colors.neutral700,
  },
  mainActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.sm,
  },
  halfButton: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  modalSubtitle: {
    color: Colors.neutral600,
    marginBottom: Spacing.md,
  },
  contactPrefLabel: {
    marginBottom: Spacing.xs,
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  radioItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral300,
    borderRadius: Radii.md,
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  radioItemSelected: {
    borderColor: Colors.primary500,
    backgroundColor: Colors.primary50,
  },
  radioText: {
    color: Colors.neutral700,
  },
  radioTextSelected: {
    color: Colors.primary700,
    fontWeight: 'bold',
  },
  modalSubmitButton: {
    marginTop: Spacing.md,
  },
`;

content = content.replace('contactButton: {\n    marginTop: Spacing.md,\n  },', newStyles);

fs.writeFileSync(path, content);
