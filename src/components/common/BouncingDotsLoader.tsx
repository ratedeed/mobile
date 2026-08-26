import React, { useEffect, useRef } from 'react';
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
 * BouncingDotsLoader
 * Three (or more) dots that bounce and scale in a synchronized, staggered native wave.
 * Uses 100% native Animated.delay with matched loop periods to guarantee dots NEVER desync.
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
  
  const half = speed / 2;
  const stagger = speed / 7.5; // ~160ms for 1200ms duration

  const animsRef = useRef<Animated.Value[]>([]);
  if (animsRef.current.length !== dotCount) {
    animsRef.current = Array.from(
      { length: dotCount },
      (_, i) => animsRef.current[i] || new Animated.Value(0)
    );
  }
  const anims = animsRef.current;

  useEffect(() => {
    const ease = Easing.bezier(0.25, 1, 0.5, 1);
    
    // Reset all anim values
    anims.forEach((anim) => anim.setValue(0));

    const totalStagger = (dotCount - 1) * stagger;

    const loops = anims.map((anim, i) => {
      const preDelay = i * stagger;
      const postDelay = totalStagger - preDelay;

      const sequence: Animated.CompositeAnimation[] = [
        ...(preDelay > 0 ? [Animated.delay(preDelay)] : []),
        Animated.timing(anim, {
          toValue: 1,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: half,
          easing: ease,
          useNativeDriver: true,
        }),
        ...(postDelay > 0 ? [Animated.delay(postDelay)] : []),
      ];

      const loop = Animated.loop(Animated.sequence(sequence));
      loop.start();
      return loop;
    });

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [anims, half, stagger, dotCount]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.container, { gap: gapSize }, style]}
    >
      {anims.map((anim, i) => {
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -BOUNCE],
        });
        const scaleAnim = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1.15],
        });
        const opacity = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.45, 1],
        });
        
        return (
          <Animated.View
            key={i}
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
              transform: [{ translateY }, { scale: scaleAnim }],
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