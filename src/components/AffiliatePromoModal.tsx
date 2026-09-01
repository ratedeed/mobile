import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import HapticFeedback from '../utils/haptics';

interface AffiliatePromoModalProps {
  visible: boolean;
  onClose: () => void;
  onExplore: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AffiliatePromoModal({
  visible,
  onClose,
  onExplore,
}: AffiliatePromoModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleExplore = () => {
    HapticFeedback.light();
    onExplore();
  };

  const handleClose = () => {
    HapticFeedback.light();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View
        className="flex-1 justify-end sm:justify-center items-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      >
        <Pressable className="flex-1 w-full" onPress={handleClose} />

        <View
          className="w-full sm:w-[92%] max-w-[440px] rounded-t-3xl sm:rounded-3xl p-6 pb-8 shadow-2xl"
          style={{ backgroundColor: isDark ? '#171717' : '#ffffff' }}
        >
          {/* Top Handle on Mobile */}
          <View className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto mb-4 sm:hidden" />

          {/* Close Button Top Right */}
          <Pressable
            onPress={handleClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center z-10"
          >
            <FontAwesome5 name="times" size={13} color={isDark ? '#a3a3a3' : '#737373'} />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Header Badge & Hero Icon */}
            <View className="items-center mt-1 mb-3">
              <View className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 items-center justify-center mb-3">
                <FontAwesome5 name="gift" size={26} color="#F59E0B" />
              </View>

              <View className="bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/40 px-3 py-1 rounded-full mb-2">
                <Text className="text-amber-600 dark:text-amber-400 text-[11px] font-black uppercase tracking-wider">
                  Partner Program
                </Text>
              </View>

              <Text className="text-2xl font-black text-neutral-900 dark:text-neutral-50 text-center tracking-tight">
                Earn 4% on Every Project
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 text-center mt-1.5 px-2 leading-5">
                Invite local contractors to Ratedeed and earn a cash commission on all their completed jobs for 90 days.
              </Text>
            </View>

            {/* Value Props Card */}
            <View className="bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-4 my-3 gap-3.5">
              {/* Feature 1 */}
              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 items-center justify-center mt-0.5">
                  <FontAwesome5 name="dollar-sign" size={14} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    4% Direct Cash Commission
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-4">
                    Earn $400 on a $10,000 roof or $1,000 on a $25,000 kitchen remodel.
                  </Text>
                </View>
              </View>

              {/* Feature 2 */}
              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 items-center justify-center mt-0.5">
                  <FontAwesome5 name="university" size={12} color="#6366F1" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Automated Stripe Payouts
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-4">
                    Commissions deposit straight to your bank account when escrow funds release.
                  </Text>
                </View>
              </View>

              {/* Feature 3 */}
              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 items-center justify-center mt-0.5">
                  <FontAwesome5 name="clock" size={12} color="#F59E0B" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    90-Day Earning Window
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-4">
                    Earn on every single job your referred pros complete for their first 3 months.
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="mt-2 gap-2">
              <Pressable
                onPress={handleExplore}
                className="w-full py-3.5 bg-indigo-600 rounded-xl items-center justify-center shadow-md active:opacity-90 flex-row"
                style={{ gap: 8 }}
              >
                <Text className="text-white font-bold text-sm">Get My Referral Link</Text>
                <FontAwesome5 name="arrow-right" size={12} color="#ffffff" />
              </Pressable>

              <Pressable
                onPress={handleClose}
                className="w-full py-2.5 items-center justify-center active:opacity-60"
              >
                <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
                  Maybe Later
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
