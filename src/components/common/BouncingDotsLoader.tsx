import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';

// Using a fallback design token if your external Colors module isn't loaded
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
 * Three (or more) dots that bounce and scale in a staggered wave.
 * 1.2s loop, -8px translateY, 0.85→1.15 scale, 0.45→1 opacity,
 * cubic-bezier(0.25, 1, 0.5, 1) easing, 160ms stagger.
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
  // Adjusted to 7.5 to make stagger exactly 160ms when speed is 1200ms
  const stagger = speed / 7.5; 

  // Safely regenerate/preserve animation values if dotCount changes dynamically
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
    
    const loops = anims.map((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
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
        ]),
      );
      
      // Delay starting the loop to create the stagger wave effect
      const startDelay = setTimeout(() => {
        loop.start();
      }, i * stagger);

      return { loop, startDelay };
    });

    return () => {
      loops.forEach(({ loop, startDelay }) => {
        clearTimeout(startDelay);
        loop.stop();
      });
    };
  }, [anims, half, stagger]);

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