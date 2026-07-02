import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { API_BASE_URL } from '../config';
import { post as apiPost } from '../utils/apiClient';
import Typography from './common/Typography';
import Button from './common/Button';
import Card from './common/Card';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';

interface ReportReason {
  key: string;
  label: string;
  description: string;
}

const REPORT_REASONS: ReportReason[] = [
  {
    key: 'misleading',
    label: 'Misleading Information',
    description: 'False or deceptive business information',
  },
  {
    key: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Offensive, explicit, or inappropriate material',
  },
  {
    key: 'spam',
    label: 'Spam or Scam',
    description: 'Fake reviews, spam, or fraudulent activity',
  },
  {
    key: 'unprofessional',
    label: 'Unprofessional Behavior',
    description: 'Poor service quality or unprofessional conduct',
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Something else not listed above',
  },
];

interface ReportButtonProps {
  reportedItemId: string;
  onModel: 'User' | 'Contractor' | 'Review' | 'Post';
  renderTrigger?: ({ onPress }: { onPress: () => void }) => React.ReactNode;
}

const ReportButton: React.FC<ReportButtonProps> = ({
  reportedItemId,
  onModel,
  renderTrigger,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleOpen = () => {
    setModalVisible(true);
    setSelectedReason(null);
    setAdditionalDetails('');
    setSubmitted(false);
  };

  const handleClose = () => {
    setModalVisible(false);
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);
    try {
      const reportData = {
        reportedItem: reportedItemId,
        onModel,
        reason: selectedReason,
        additionalDetails: additionalDetails.trim() || undefined,
      };

      await apiPost(`${API_BASE_URL}/api/reports`, reportData);

      setSubmitted(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit report';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDefaultTrigger = ({ onPress }: { onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={styles.triggerButton}
      accessibilityLabel="Report this content"
      accessibilityRole="button"
    >
      <FontAwesome5 name="flag" size={14} color={Colors.neutral500} />
    </TouchableOpacity>
  );

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ onPress: handleOpen })
      ) : (
        renderDefaultTrigger({ onPress: handleOpen })
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {submitted ? (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <FontAwesome5 name="check" size={32} color={Colors.neutral50} />
                </View>
                <Typography variant="h4" style={styles.successTitle}>
                  Report Submitted
                </Typography>
                <Typography variant="body" style={styles.successMessage}>
                  Thank you for helping keep Ratedeed safe. We will review your report shortly.
                </Typography>
                <Button
                  title="Done"
                  onPress={handleClose}
                  style={styles.doneButton}
                />
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Typography variant="h4" style={styles.modalTitle}>
                    Report Content
                  </Typography>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.closeButton}
                    accessibilityLabel="Close"
                  >
                    <FontAwesome5 name="times" size={18} color={Colors.neutral600} />
                  </TouchableOpacity>
                </View>

                <Typography variant="body" style={styles.modalSubtitle}>
                  Why are you reporting this?
                </Typography>

                <View style={styles.reasonsList}>
                  {REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.key}
                      style={[
                        styles.reasonItem,
                        selectedReason === reason.key && styles.reasonItemSelected,
                      ]}
                      onPress={() => setSelectedReason(reason.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selectedReason === reason.key }}
                    >
                      <View style={styles.radioOuter}>
                        {selectedReason === reason.key && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <View style={styles.reasonContent}>
                        <Typography
                          variant="body"
                          style={[
                            styles.reasonLabel,
                            selectedReason === reason.key && styles.reasonLabelSelected,
                          ]}
                        >
                          {reason.label}
                        </Typography>
                        <Typography variant="caption" style={styles.reasonDescription}>
                          {reason.description}
                        </Typography>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {selectedReason && (
                  <View style={styles.submitContainer}>
                    <Button
                      title={isSubmitting ? 'Submitting...' : 'Submit Report'}
                      onPress={handleSubmit}
                      disabled={isSubmitting || !selectedReason}
                      style={styles.submitButton}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerButton: {
    padding: Spacing.sm,
    borderRadius: Radii.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.neutral50,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    color: Colors.neutral900,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalSubtitle: {
    color: Colors.neutral600,
    marginBottom: Spacing.lg,
  },
  reasonsList: {
    marginBottom: Spacing.lg,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: Radii.md,
    backgroundColor: Colors.neutral100,
  },
  reasonItemSelected: {
    backgroundColor: Colors.primary50,
    borderWidth: 1,
    borderColor: Colors.primary500,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.neutral400,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary500,
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    color: Colors.neutral800,
    fontWeight: '500',
  },
  reasonLabelSelected: {
    color: Colors.primary700,
    fontWeight: '600',
  },
  reasonDescription: {
    color: Colors.neutral500,
    marginTop: 2,
  },
  submitContainer: {
    marginTop: Spacing.md,
  },
  submitButton: {
    backgroundColor: Colors.error,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  successMessage: {
    color: Colors.neutral600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  doneButton: {
    minWidth: 120,
  },
});

export default ReportButton;
