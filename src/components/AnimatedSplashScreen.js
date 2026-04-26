import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { FontAwesome5 } from '@expo/vector-icons';

const SPLASH_COLOR = '#ffffff'; 
const LOGO_COLOR = '#4F46E5'; // Indigo-600

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

const AnimatedSplashScreen = ({ onComplete, minDuration = 2800 }) => {
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(15)).current;
  
  const pulse1Scale = useRef(new Animated.Value(0.8)).current;
  const pulse1Opacity = useRef(new Animated.Value(0)).current;
  
  const pulse2Scale = useRef(new Animated.Value(0.8)).current;
  const pulse2Opacity = useRef(new Animated.Value(0)).current;

  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const fadeAnim = useRef(new Animated.Value(1)).current; // For the entire overlay

  useEffect(() => {
    // Hide the native splash screen immediately, as our identical-looking animated view is now ready.
    setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 50);

    const customEasing = Easing.bezier(0.22, 1, 0.36, 1);

    // Logo Animation: Do a slight heartbeat pulse since it starts at full size
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(logoScale, {
        toValue: 1.1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: customEasing,
      })
    ]).start();

    // Wordmark Animation
    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: customEasing,
        }),
        Animated.timing(wordmarkY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
          easing: customEasing,
        })
      ])
    ]).start();

    // Pulse rings
    const createPulse = (scaleAnim, opacityAnim, delay, maxScale1, maxScale2, maxOpacity) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(opacityAnim, { toValue: maxOpacity, duration: 1200, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
              Animated.timing(opacityAnim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.in(Easing.ease) })
            ]),
            Animated.sequence([
              Animated.timing(scaleAnim, { toValue: maxScale1, duration: 1200, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
              Animated.timing(scaleAnim, { toValue: maxScale2, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
              Animated.timing(scaleAnim, { toValue: 0.8, duration: 0, useNativeDriver: true })
            ])
          ])
        )
      ]).start();
    };

    createPulse(pulse1Scale, pulse1Opacity, 300, 1.4, 1.6, 0.5);
    createPulse(pulse2Scale, pulse2Opacity, 600, 1.8, 2.0, 0.3);

    // Dots container fade in
    Animated.sequence([
      Animated.delay(1000),
      Animated.timing(dotsOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();

    // Dots bouncing
    const animateDot = (anim, delay) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
          ])
        )
      ]).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);

    // Fade out entire splash screen at the end
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start(() => {
        onComplete();
      });
    }, minDuration);

    return () => clearTimeout(timer);
  }, []);

  const getDotStyle = (anim) => ({
    transform: [{
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] })
    }],
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: SPLASH_COLOR, opacity: fadeAnim }]} pointerEvents="none">
      <View style={styles.logoContainer}>
        {/* Pulse 2 */}
        <Animated.View style={[styles.pulseRing, {
          borderWidth: 1.5,
          borderColor: 'rgba(79, 70, 229, 0.2)',
          transform: [{ scale: pulse2Scale }],
          opacity: pulse2Opacity
        }]} />
        
        {/* Pulse 1 */}
        <Animated.View style={[styles.pulseRing, {
          borderWidth: 2,
          borderColor: 'rgba(79, 70, 229, 0.3)',
          transform: [{ scale: pulse1Scale }],
          opacity: pulse1Opacity
        }]} />

        {/* Logo */}
        <Animated.View style={{
          transform: [{ scale: logoScale }],
          opacity: logoOpacity,
          zIndex: 10,
        }}>
          <FontAwesome5 name="hammer" size={110} color={LOGO_COLOR} />
        </Animated.View>

        {/* Wordmark */}
        <Animated.View style={{
          opacity: wordmarkOpacity,
          transform: [{ translateY: wordmarkY }],
          marginTop: 24,
          zIndex: 10,
        }}>
          <Text style={styles.wordmark}>ratedeed</Text>
        </Animated.View>
      </View>

      {/* Dots */}
      <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity }]}>
        <View style={styles.dotsWrapper}>
          <Animated.View style={[styles.dot, getDotStyle(dot1)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot2)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot3)]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: 'bold',
    color: LOGO_COLOR,
    letterSpacing: -0.5,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
    width: '100%',
  },
  dotsWrapper: {
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LOGO_COLOR,
    marginHorizontal: 3,
  }
});

export default AnimatedSplashScreen;