import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
  useReducedMotion,
} from 'react-native-reanimated';
import { Colors } from '../../constants/designTokens';

interface BouncingDotsLoaderProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: ViewStyle;
  dotCount?: number;
  /** Milliseconds for one full up-then-down cycle per dot. Default 600. */
  cycleDuration?: number;
}

const SIZE_MAP = {
  small:  { dot: 5,  gap: 4, bounce: 10 },
  medium: { dot: 7,  gap: 6, bounce: 14 },
  large:  { dot: 10, gap: 8, bounce: 20 },
};

// Dot must be defined BEFORE the parent (const is not hoisted).
// Each dot needs its own shared value — extract as a component so hooks
// aren't called inside .map() at the parent level.
type DotProps = {
  dotSize: number;
  color: string;
  bounce: number;
  cycleDuration: number;
  staggerDelay: number;
  reduceMotion: boolean;
};

const Dot: React.FC<DotProps> = ({
  dotSize, color, bounce, cycleDuration, staggerDelay, reduceMotion,
}) => {
  const sv = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      sv.value = 0;
      return;
    }
    const halfCycle = cycleDuration / 2;
    // withRepeat(reverse=true) alternates 0→1→0→1... so a single timing
    // gives us the full up-down loop. Cleaner than withSequence.
    sv.value = withDelay(
      staggerDelay,
      withRepeat(
        withTiming(1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        -1,    // infinite
        true,  // reverse each iteration
      ),
    );
  }, [sv, reduceMotion, staggerDelay, cycleDuration]);

  const animStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { transform: [{ translateY: 0 }], opacity: 0.6 };
    }
    return {
      transform: [{ translateY: interpolate(sv.value, [0, 1], [0, -bounce]) }],
      opacity: interpolate(sv.value, [0, 1], [0.4, 1]),
    };
  });

  return (
    <Animated.View
      style={[
        { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color },
        animStyle,
      ]}
    />
  );
};

export const BouncingDotsLoader: React.FC<BouncingDotsLoaderProps> = ({
  size = 'medium',
  color,
  style,
  dotCount = 3,
  cycleDuration = 600,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;

  const { dot: dotSize, gap, bounce } = SIZE_MAP[size];
  const dotColor = color ?? (isDark ? Colors.neutral100 : Colors.neutral900);

  // Stagger so dots wave, not bounce together.
  // Dividing by dotCount gives an even phase offset across the cycle.
  const stagger = cycleDuration / dotCount;

  // Container height: dot diameter + bounce distance + small breathing room
  const containerHeight = dotSize + bounce + 4;

  return (
    <View
      style={[styles.container, { height: containerHeight, gap }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: dotCount }).map((_, i) => (
        <Dot
          key={i}
          dotSize={dotSize}
          color={dotColor}
          bounce={bounce}
          cycleDuration={cycleDuration}
          staggerDelay={i * stagger}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // gap prop handles horizontal spacing — no marginHorizontal on dots
  },
});

export default BouncingDotsLoader;