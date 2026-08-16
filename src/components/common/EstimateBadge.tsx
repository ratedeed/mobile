import React, { useEffect, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Circle, Rect, Polygon, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type EstimateBadgeType = 'free' | 'service_fee' | 'applied_credit' | 'virtual_only';

interface EstimateBadgeProps {
  type?: EstimateBadgeType;
  feeAmount?: number;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  onPress?: () => void;
}

export const EstimateBadge = memo(function EstimateBadge({
  type = 'free',
  feeAmount = 75,
  size = 'md',
  animate = true,
  onPress,
}: EstimateBadgeProps) {
  const isFree = type === 'free' || type === 'virtual_only';
  const label = isFree 
    ? 'Free Estimates' 
    : feeAmount 
      ? `$${feeAmount} · Credited to Repair` 
      : 'Fee Credited to Repair';

  const scale = useSharedValue(animate ? 0.85 : 1);
  const opacity = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (animate) {
      scale.value = withDelay(
        100,
        withSpring(1, { damping: 12, stiffness: 120 })
      );
      opacity.value = withDelay(
        100,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
      );
    }
  }, [animate, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  }[size];

  const fontSize = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
  }[size];

  const padding = {
    sm: 'py-0.5 px-2',
    md: 'py-1 px-2.5',
    lg: 'py-1.5 px-3',
  }[size];

  return (
    <AnimatedPressable
      onPress={() => {
        scale.value = withSequence(
          withSpring(0.92, { damping: 10 }),
          withSpring(1, { damping: 12 })
        );
        if (onPress) onPress();
      }}
      style={animatedStyle}
      className={`flex-row items-center rounded-full border shadow-sm ${padding} ${
        isFree
          ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60'
          : 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/60'
      }`}
    >
      <View className="mr-1.5">
        <Svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none">
          <Defs>
            <LinearGradient id="m-gold-coin" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#F59E0B" />
              <Stop offset="50%" stopColor="#D97706" />
              <Stop offset="100%" stopColor="#B45309" />
            </LinearGradient>
            <LinearGradient id="m-indigo-coin" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#818CF8" />
              <Stop offset="50%" stopColor="#6366F1" />
              <Stop offset="100%" stopColor="#4338CA" />
            </LinearGradient>
          </Defs>

          {/* Outer Ring */}
          <Circle cx="12" cy="12" r="10.5" stroke={isFree ? 'url(#m-gold-coin)' : 'url(#m-indigo-coin)'} strokeWidth="1.2" />
          <Circle cx="12" cy="12" r="8.5" stroke={isFree ? 'url(#m-gold-coin)' : 'url(#m-indigo-coin)'} strokeWidth="0.8" strokeDasharray="1 1.8" />

          {isFree ? (
            <Svg>
              <Polygon points="12,4 20,10 4,10" fill="url(#m-gold-coin)" />
              <Rect x="6.5" y="11" width="2.5" height="5.5" fill="url(#m-gold-coin)" />
              <Rect x="10.75" y="11" width="2.5" height="5.5" fill="url(#m-gold-coin)" />
              <Rect x="15" y="11" width="2.5" height="5.5" fill="url(#m-gold-coin)" />
              <Rect x="5" y="17.5" width="14" height="2" rx="0.5" fill="url(#m-gold-coin)" />
            </Svg>
          ) : (
            <Svg>
              <Path d="M12 3L5 6V11C5 16 8.5 20.5 12 21.8C15.5 20.5 19 16 19 11V6L12 3Z" fill="url(#m-indigo-coin)" />
              <Path d="M9 11.5L11 13.5L15 9.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </Svg>
      </View>

      <Text className={`${fontSize} font-bold uppercase tracking-wider ${
        isFree ? 'text-amber-900 dark:text-amber-200' : 'text-indigo-900 dark:text-indigo-200'
      }`}>
        {label}
      </Text>
    </AnimatedPressable>
  );
});

export default EstimateBadge;
