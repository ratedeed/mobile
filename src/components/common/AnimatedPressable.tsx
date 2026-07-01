import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPress = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  onPress,
  style,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const resolveStyle = (state: { pressed: boolean }) => {
    const resolved = typeof style === 'function' ? style(state) : style;
    return [animatedStyle, resolved];
  };

  return (
    <AnimatedPress
      onPressIn={(e) => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        props.onPressOut?.(e);
      }}
      onPress={onPress}
      style={resolveStyle as any}
      {...props}
    >
      {children}
    </AnimatedPress>
  );
};

export default AnimatedPressable;
