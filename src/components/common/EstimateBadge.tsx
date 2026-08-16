import React, { useEffect, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';
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
      ? `$${feeAmount} · Applied to Repair` 
      : 'Applied to Repair';

  const scale = useSharedValue(animate ? 0.88 : 1);
  const opacity = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (animate) {
      scale.value = withDelay(
        80,
        withSpring(1, { damping: 12, stiffness: 120 })
      );
      opacity.value = withDelay(
        80,
        withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
      );
    }
  }, [animate, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 19,
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
          ? 'bg-[#FFFDF9] dark:bg-amber-950/40 border-[#D4AF37]/50 dark:border-amber-700/60'
          : 'bg-[#F9FAFF] dark:bg-indigo-950/40 border-[#4F46E5]/40 dark:border-indigo-700/60'
      }`}
    >
      <View className="mr-1.5">
        <Svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none">
          <Defs>
            <LinearGradient id="mob-laurel-gold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FFECA8" />
              <Stop offset="40%" stopColor="#E5C158" />
              <Stop offset="70%" stopColor="#C69214" />
              <Stop offset="100%" stopColor="#8A6308" />
            </LinearGradient>
            <LinearGradient id="mob-credit-indigo" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#A5B4FC" />
              <Stop offset="50%" stopColor="#6366F1" />
              <Stop offset="100%" stopColor="#4338CA" />
            </LinearGradient>
          </Defs>

          {isFree ? (
            /* Roman Laurel Wreath encircling Roman Star Gem */
            <Svg>
              {/* Left Laurel */}
              <Path
                d="M10 20C7 18 4.5 15 4.5 11C4.5 7.5 7 4 9.5 3"
                stroke="url(#mob-laurel-gold)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <Ellipse cx="6" cy="14" rx="1.8" ry="1" fill="url(#mob-laurel-gold)" />
              <Ellipse cx="7.2" cy="10" rx="1.8" ry="1" fill="url(#mob-laurel-gold)" />
              <Ellipse cx="9" cy="6.2" rx="1.6" ry="0.9" fill="url(#mob-laurel-gold)" />

              {/* Right Laurel */}
              <Path
                d="M14 20C17 18 19.5 15 19.5 11C19.5 7.5 17 4 14.5 3"
                stroke="url(#mob-laurel-gold)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <Ellipse cx="18" cy="14" rx="1.8" ry="1" fill="url(#mob-laurel-gold)" />
              <Ellipse cx="16.8" cy="10" rx="1.8" ry="1" fill="url(#mob-laurel-gold)" />
              <Ellipse cx="15" cy="6.2" rx="1.6" ry="0.9" fill="url(#mob-laurel-gold)" />

              {/* Bottom Knot */}
              <Circle cx="12" cy="20.5" r="1.5" fill="url(#mob-laurel-gold)" />

              {/* Center Star Gem */}
              <Path
                d="M12 7.5L13.2 10.8L16.5 12L13.2 13.2L12 16.5L10.8 13.2L7.5 12L10.8 10.8Z"
                fill="url(#mob-laurel-gold)"
              />
            </Svg>
          ) : (
            /* Roman Balance Scale for Credited Diagnostic Fee */
            <Svg>
              <Circle cx="12" cy="12" r="9" stroke="url(#mob-credit-indigo)" strokeWidth="1.4" />
              <Path
                d="M12 5V18M8 9H16M7 14L8 9L9 14ZM15 14L16 9L17 14Z"
                stroke="url(#mob-credit-indigo)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </Svg>
      </View>

      <Text className={`${fontSize} font-bold uppercase tracking-wider ${
        isFree ? 'text-[#6B4F10] dark:text-amber-200' : 'text-[#3730A3] dark:text-indigo-200'
      }`}>
        {label}
      </Text>
    </AnimatedPressable>
  );
});

export default EstimateBadge;
