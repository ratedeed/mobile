import { useRef, useCallback } from 'react';
import { Animated, LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const useStaggeredAnimation = (itemCount: number, baseDelay = 50) => {
  const animations = useRef(
    Array.from({ length: itemCount }, () => new Animated.Value(0))
  ).current;

  const fadeIn = useCallback((index: number, duration = 300) => {
    Animated.timing(animations[index], {
      toValue: 1,
      duration,
      delay: index * baseDelay,
      useNativeDriver: true,
    }).start();
  }, [animations, baseDelay]);

  const fadeOut = useCallback((index: number, duration = 200) => {
    Animated.timing(animations[index], {
      toValue: 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [animations]);

  const getAnimationStyle = (index: number) => ({
    opacity: animations[index],
    transform: [
      {
        translateY: animations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  });

  const fadeInAll = useCallback((duration = 300) => {
    Animated.parallel(
      animations.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration,
          delay: index * baseDelay,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [animations, baseDelay]);

  const fadeOutAll = useCallback((duration = 200) => {
    Animated.parallel(
      animations.map((anim) =>
        Animated.timing(anim, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [animations]);

  return {
    fadeIn,
    fadeOut,
    fadeInAll,
    fadeOutAll,
    getAnimationStyle,
    animations,
  };
};

export const useScaleOnPress = () => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleValue, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  }, [scaleValue]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [scaleValue]);

  const getScaleStyle = useCallback(() => ({
    transform: [{ scale: scaleValue }],
  }), [scaleValue]);

  return {
    handlePressIn,
    handlePressOut,
    getScaleStyle,
  };
};

export const LayoutAnimations = {
  easeInEaseOut: {
    duration: 300,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  },
  spring: {
    duration: 400,
    create: {
      type: LayoutAnimation.Types.spring,
      property: LayoutAnimation.Properties.scaleXY,
    },
    update: {
      type: LayoutAnimation.Types.spring,
      springDamping: 0.8,
    },
  },
};

export const triggerLayoutAnimation = (type = 'easeInEaseOut') => {
  LayoutAnimation.configureNext(LayoutAnimations[type as keyof typeof LayoutAnimations] || LayoutAnimations.easeInEaseOut);
};