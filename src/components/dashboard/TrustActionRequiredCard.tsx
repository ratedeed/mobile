import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface TrustActionRequiredCardProps {
  onboardingComplete: boolean;
  licenseStatus?: string;
  stripeStatus?: { chargesEnabled?: boolean };
  onConnectStripe: () => void;
  onVerifyLicense: () => void;
}

export const TrustActionRequiredCard: React.FC<TrustActionRequiredCardProps> = ({
  onboardingComplete,
  licenseStatus,
  stripeStatus,
  onConnectStripe,
  onVerifyLicense,
}) => {
  if (onboardingComplete && licenseStatus === 'approved' && stripeStatus?.chargesEnabled) {
    return null;
  }

  return (
    <View className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4">
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <FontAwesome5 name="exclamation-circle" size={14} color="#d97706" />
        <Text className="text-sm font-bold text-amber-800 dark:text-amber-400">Action Required</Text>
      </View>
      <Text className="text-xs text-amber-700 dark:text-amber-300/80 mt-1 leading-relaxed">
        {!stripeStatus?.chargesEnabled && licenseStatus !== 'approved'
          ? 'Connect your Stripe account to receive payouts, and verify your license to build trust with clients.'
          : !stripeStatus?.chargesEnabled
          ? 'Connect your Stripe account to receive payouts from clients.'
          : 'Verify your license to build trust with clients and get a Verified Pro badge.'}
      </Text>
      <View className="mt-3" style={{ gap: 8 }}>
        {!stripeStatus?.chargesEnabled && (
          <Pressable
            onPress={onConnectStripe}
            className="flex-row items-center justify-between bg-white dark:bg-neutral-900 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40"
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <FontAwesome5 name="credit-card" size={12} color="#d97706" />
              <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Connect Stripe Account
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={10} color="#d97706" />
          </Pressable>
        )}
        {licenseStatus !== 'approved' && (
          <Pressable
            onPress={onVerifyLicense}
            className="flex-row items-center justify-between bg-white dark:bg-neutral-900 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40"
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <FontAwesome5 name="id-card" size={12} color="#d97706" />
              <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Verify CSLB License
              </Text>
            </View>
            <FontAwesome5 name="chevron-right" size={10} color="#d97706" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

export default TrustActionRequiredCard;
