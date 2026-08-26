import React, { useEffect, useRef, useMemo } from 'react';
import {
  Animated,
  Easing,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';

const DEFAULT_COLOR = '#4F46E5'; 

interface BouncingDotsLoaderProps {
  /** Dot diameter in px (number) OR a preset: 'small' | 'medium' | 'large' */
  size?: 'small' | 'medium' | 'large' | number;
  /** Gap between dots in px (used when `size` is a number; defaults from preset otherwise) */
  gap?: number;
  /** Fill color of the dots. Defaults to Ratedeed brand indigo or fallback color. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  dotCount?: number;
  speed?: number;
}

const DURATION = 1200;
const BOUNCE = 8;

const SIZE_MAP: Record<
  'small' | 'medium' | 'large',
  { dot: number; gap: number }
> = {
  small: { dot: 7, gap: 4 },
  medium: { dot: 10, gap: 6 },
  large: { dot: 14, gap: 8 },
};

/**
 * Generates smooth sine-arc wave interpolation ranges for a dot index.
 */
function createDotRanges(index: number, count: number) {
  const staggerStep = 0.15;
  const span = 0.42;
  const start = index * staggerStep;
  const p1 = start + span * 0.25;
  const p2 = start + span * 0.50; // Peak
  const p3 = start + span * 0.75;
  const end = Math.min(start + span, 1.0);

  const raw = [
    { t: 0.0, y: 0, s: 0.85, o: 0.45 },
    ...(start > 0.001 ? [{ t: start, y: 0, s: 0.85, o: 0.45 }] : []),
    { t: p1, y: -BOUNCE * 0.71, s: 1.05, o: 0.85 },
    { t: p2, y: -BOUNCE, s: 1.20, o: 1.00 },
    { t: p3, y: -BOUNCE * 0.71, s: 1.05, o: 0.85 },
    { t: end, y: 0, s: 0.85, o: 0.45 },
    ...(end < 0.999 ? [{ t: 1.0, y: 0, s: 0.85, o: 0.45 }] : []),
  ];

  // Filter to guarantee strictly increasing t values
  const points: typeof raw = [];
  for (const pt of raw) {
    if (points.length === 0 || pt.t > points[points.length - 1].t + 0.0001) {
      points.push(pt);
    }
  }

  // Ensure last point is exactly 1.0
  if (points[points.length - 1].t < 1.0) {
    points.push({ t: 1.0, y: 0, s: 0.85, o: 0.45 });
  }

  return {
    inputRange: points.map((p) => p.t),
    translateYRange: points.map((p) => p.y),
    scaleRange: points.map((p) => p.s),
    opacityRange: points.map((p) => p.o),
  };
}

/**
 * BouncingDotsLoader
 * Three (or more) dots that bounce in a mathematical staggered wave derived from a SINGLE master clock.
 * Guaranteed 100% synchronized, smooth 60fps native wave that cannot drift or clump together.
 */
export const BouncingDotsLoader: React.FC<BouncingDotsLoaderProps> = ({
  size = 'medium',
  gap,
  color = DEFAULT_COLOR,
  style,
  dotCount = 3,
  speed = DURATION,
}) => {
  const isNumeric = typeof size === 'number';
  const preset = SIZE_MAP[(isNumeric ? 'medium' : size) as 'small' | 'medium' | 'large'];
  const dot = isNumeric ? (size as number) : preset.dot;
  const gapSize = gap ?? preset.gap;

  const masterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    masterAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(masterAnim, {
        toValue: 1,
        duration: speed,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [masterAnim, speed]);

  const dotConfigs = useMemo(() => {
    return Array.from({ length: dotCount }, (_, i) => createDotRanges(i, dotCount));
  }, [dotCount]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.container, { gap: gapSize }, style]}
    >
      {dotConfigs.map((config, i) => {
        const translateY = masterAnim.interpolate({
          inputRange: config.inputRange,
          outputRange: config.translateYRange,
        });
        const scale = masterAnim.interpolate({
          inputRange: config.inputRange,
          outputRange: config.scaleRange,
        });
        const opacity = masterAnim.interpolate({
          inputRange: config.inputRange,
          outputRange: config.opacityRange,
        });

        return (
          <Animated.View
            key={i}
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
              transform: [{ translateY }, { scale }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BouncingDotsLoader;