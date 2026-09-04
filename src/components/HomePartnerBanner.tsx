import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import HapticFeedback from '../utils/haptics';

interface HomePartnerBannerProps {
  onPress: () => void;
  onDismiss?: () => void;
}

export default function HomePartnerBanner({ onPress, onDismiss }: HomePartnerBannerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    HapticFeedback.light();
    onPress();
  };

  const handleDismiss = () => {
    HapticFeedback.selection();
    if (onDismiss) onDismiss();
  };

  return (
    <View className="px-4 mb-3">
      <Pressable
        onPress={handlePress}
        className="rounded-2xl p-4 bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden active:opacity-95"
      >
        {/* Background Accent Glow */}
        <View className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />

        <View className="flex-row items-center justify-between mb-1.5">
          <View className="flex-row items-center gap-1.5 bg-amber-400/20 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
            <FontAwesome5 name="gift" size={10} color="#FBBF24" />
            <Text className="text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">
              Partner Rewards
            </Text>
          </View>

          {onDismiss && (
            <Pressable
              onPress={handleDismiss}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              className="w-5 h-5 rounded-full bg-slate-800 items-center justify-center"
            >
              <FontAwesome5 name="times" size={9} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center justify-between gap-3 mt-1">
          <View className="flex-1 pr-2">
            <Text className="text-white text-base font-black tracking-tight">
              Earn 4% Cash on Referrals
            </Text>
            <Text className="text-slate-300 text-xs mt-0.5 leading-4" numberOfLines={2}>
              Invite local contractors to Ratedeed. When they complete escrow jobs, you get a 4% cash payout.
            </Text>
          </View>

          <View className="bg-amber-500 px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-sm">
            <Text className="text-slate-950 text-xs font-black">Invite</Text>
            <FontAwesome5 name="arrow-right" size={10} color="#020617" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
