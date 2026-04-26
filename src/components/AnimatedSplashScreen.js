import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { FontAwesome5 } from '@expo/vector-icons';

const SPLASH_COLOR = '#ffffff';
const LOGO_COLOR = '#4F46E5'; // Indigo-600

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

const AnimatedSplashScreen = ({ onComplete, minDuration = 2800 }) => {
  // Exact Airbnb starting values: 0.3 scale, 0 opacity
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(15)).current;

  // Pulse rings start at 0.8 (like Airbnb) and expand out once
  const pulse1Scale = useRef(new Animated.Value(0.8)).current;
  const pulse1Opacity = useRef(new Animated.Value(0)).current;

  const pulse2Scale = useRef(new Animated.Value(0.8)).current;
  const pulse2Opacity = useRef(new Animated.Value(0)).current;

  const dotsOpacity = useRef(new Animated.Value(0)).current;
  
  // Dots start at scale 1, opacity 0.4 (like Airbnb)
  const dot1Scale = useRef(new Animated.Value(1)).current;
  const dot1Op = useRef(new Animated.Value(0.4)).current;
  const dot2Scale = useRef(new Animated.Value(1)).current;
  const dot2Op = useRef(new Animated.Value(0.4)).current;
  const dot3Scale = useRef(new Animated.Value(1)).current;
  const dot3Op = useRef(new Animated.Value(0.4)).current;

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide native splash immediately (it's just white, so no flash)
    SplashScreen.hideAsync().catch(() => {});

    // Airbnb's signature "sharp out" cubic-bezier
    const airbnbEasing = Easing.bezier(0.22, 1, 0.36, 1);

    // 1. Logo Animation: 0.3 -> 1.08 -> 1.0 with overshoot
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1.08,
          duration: 700, // 70% of 1000ms
          useNativeDriver: true,
          easing: airbnbEasing,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(logoScale, {
        toValue: 1.0,
        duration: 300, // 30% of 1000ms
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();

    // 2. Wordmark Animation
    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: airbnbEasing,
        }),
        Animated.timing(wordmarkY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
          easing: airbnbEasing,
        }),
      ]),
    ]).start();

    // 3. Pulse Rings (Single elegant expansion, not infinite loop)
    const createPulse = (scaleAnim, opacityAnim, delay, maxScale, maxOpacity) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: maxScale,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: maxOpacity,
              duration: 1200, // 60% of 2000ms
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 800, // 40% of 2000ms
              useNativeDriver: true,
              easing: Easing.in(Easing.ease),
            }),
          ]),
        ]),
      ]).start();
    };

    createPulse(pulse1Scale, pulse1Opacity, 300, 1.6, 0.5);
    createPulse(pulse2Scale, pulse2Opacity, 600, 2.0, 0.3);

    // 4. Dots Container fade in
    Animated.sequence([
      Animated.delay(1000),
      Animated.timing(dotsOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // 5. Dots bouncing (scale 1 -> 1.5 -> 1, opacity 0.4 -> 1 -> 0.4)
    const animateDot = (scaleAnim, opAnim, delay) => {
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 1.5,
                duration: 600,
                useNativeDriver: true,
                easing: Easing.inOut(Easing.ease),
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
                easing: Easing.inOut(Easing.ease),
              }),
            ]),
            Animated.sequence([
              Animated.timing(opAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
                easing: Easing.inOut(Easing.ease),
              }),
              Animated.timing(opAnim, {
                toValue: 0.4,
                duration: 600,
                useNativeDriver: true,
                easing: Easing.inOut(Easing.ease),
              }),
            ]),
          ])
        ),
      ]).start();
    };

    animateDot(dot1Scale, dot1Op, 0);
    animateDot(dot2Scale, dot2Op, 200);
    animateDot(dot3Scale, dot3Op, 400);

    // 6. Fade out entire splash screen (Airbnb exit easing)
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.bezier(0.4, 0, 0.2, 1), // Airbnb exit curve
      }).start(() => {
        onComplete?.();
      });
    }, minDuration);

    return () => clearTimeout(timer);
  }, [onComplete, minDuration]);

  const getDotStyle = (scaleAnim, opAnim) => ({
    transform: [{ scale: scaleAnim }],
    opacity: opAnim,
  });

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: SPLASH_COLOR, opacity: fadeAnim }]}
      pointerEvents="none"
    >
      <View style={styles.logoContainer}>
        {/* Pulse 2 */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderWidth: 1.5,
              borderColor: 'rgba(79, 70, 229, 0.2)',
              transform: [{ scale: pulse2Scale }],
              opacity: pulse2Opacity,
            },
          ]}
        />

        {/* Pulse 1 */}
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderWidth: 2,
              borderColor: 'rgba(79, 70, 229, 0.3)',
              transform: [{ scale: pulse1Scale }],
              opacity: pulse1Opacity,
            },
          ]}
        />

        {/* Logo Group (Circle + Hammer) - Animated together */}
        <Animated.View
          style={{
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
            zIndex: 10,
          }}
        >
          <View style={styles.staticCircle}>
            <FontAwesome5 name="hammer" size={52} color={LOGO_COLOR} />
          </View>
        </Animated.View>

        {/* Wordmark */}
        <Animated.View
          style={{
            opacity: wordmarkOpacity,
            transform: [{ translateY: wordmarkY }],
            marginTop: 28,
            zIndex: 10,
          }}
        >
          <Text style={styles.wordmark}>ratedeed</Text>
        </Animated.View>
      </View>

      {/* Dots */}
      <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity }]}>
        <View style={styles.dotsWrapper}>
          <Animated.View style={[styles.dot, getDotStyle(dot1Scale, dot1Op)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot2Scale, dot2Op)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot3Scale, dot3Op)]} />
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
  },
  pulseRing: {
    position: 'absolute',
    width: 150, // Slightly larger than circle for perfect spacing
    height: 150,
    borderRadius: 75,
  },
  staticCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(79, 70, 229, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(79, 70, 229, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  },
});

export default AnimatedSplashScreen;