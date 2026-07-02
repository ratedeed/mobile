import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../constants/designTokens';

interface BouncingDotsLoaderProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: StyleProp<ViewStyle>;
  dotCount?: number;
  speed?: number;
}

const DURATION = 1200;
const BOUNCE = 8;
const STAGGER = 160;

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
 * Default color is the Ratedeed brand indigo.
 */
export const BouncingDotsLoader: React.FC<BouncingDotsLoaderProps> = ({
  size = 'medium',
  color = Colors.primary600,
  style,
  dotCount = 3,
  speed = DURATION,
}) => {
  const { dot, gap } = SIZE_MAP[size];
  const half = speed / 2;
  const stagger = speed / 8;

  const anims = useRef(
    Array.from({ length: dotCount }, () => new Animated.Value(0)),
  ).current;

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
      const startDelay = setTimeout(() => loop.start(), i * stagger);
      return { loop, startDelay };
    });
    return () => {
      loops.forEach(({ loop, startDelay }) => {
        clearTimeout(startDelay);
        loop.stop();
      });
    };
  }, [anims, dotCount, half, stagger]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.container, { gap }, style]}
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
