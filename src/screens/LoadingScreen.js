import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, useColorScheme } from 'react-native';
import { BouncingDotsLoader } from '../components/common';

const LOGO_COLOR = '#4F46E5'; // Indigo-600 (Ratedeed brand)
const LOGO_COLOR_RGB = '79, 70, 229';

const LoadingScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const splashColor = isDark ? '#09090B' : '#ffffff';
  const wordmarkColor = isDark ? '#a5b4fc' : LOGO_COLOR; // Lighter indigo for dark mode
  const glowColor = isDark ? `rgba(${LOGO_COLOR_RGB}, 0.15)` : `rgba(${LOGO_COLOR_RGB}, 0.08)`;
  const dotColor = isDark ? '#818cf8' : LOGO_COLOR; // Indigo-400 in dark, Indigo-600 in light

  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(15)).current;
  const logoGlowScale = useRef(new Animated.Value(0.6)).current;
  const logoGlowOpacity = useRef(new Animated.Value(0)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;

  const pulse1Scale = useRef(new Animated.Value(0.8)).current;
  const pulse1Opacity = useRef(new Animated.Value(0)).current;
  const pulse2Scale = useRef(new Animated.Value(0.8)).current;
  const pulse2Opacity = useRef(new Animated.Value(0)).current;

  const dotsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Custom cubic bezier roughly equivalent to Framer Motion's [0.22, 1, 0.36, 1]
    const customEasing = Easing.bezier(0.22, 1, 0.36, 1);

    // Logo Animation
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.08,
          duration: 700,
          useNativeDriver: true,
          easing: customEasing,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: customEasing,
        })
      ])
    ]).start();

    // Subtle logo rotation (very slight, like a "settling" effect)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoRotation, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(logoRotation, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    ).start();

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

    // Soft glow behind logo (breathing effect)
    Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(logoGlowOpacity, { toValue: 1, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            Animated.timing(logoGlowOpacity, { toValue: 0.4, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
          ]),
          Animated.sequence([
            Animated.timing(logoGlowScale, { toValue: 1.2, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            Animated.timing(logoGlowScale, { toValue: 0.9, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
          ])
        ])
      )
    ]).start();

    // Pulse rings (brand color)
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

    createPulse(pulse1Scale, pulse1Opacity, 300, 1.4, 1.6, 0.55);
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

  }, []);

  const logoRotate = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2deg', '2deg']
  });

  return (
    <View style={[styles.container, { backgroundColor: splashColor }]}>
      {/* Soft brand-colored radial glow behind everything */}
      <View style={[styles.ambientGlow, { backgroundColor: glowColor }]} />

      <View style={styles.logoContainer}>
        {/* Soft pulsing glow behind logo */}
        <Animated.View style={[styles.glowRing, {
          backgroundColor: `rgba(${LOGO_COLOR_RGB}, 0.12)`,
          transform: [{ scale: logoGlowScale }],
          opacity: logoGlowOpacity,
        }]} />

        {/* Pulse 2 (outer) */}
        <Animated.View style={[styles.pulseRing, {
          borderWidth: 1.5,
          borderColor: `rgba(${LOGO_COLOR_RGB}, 0.25)`,
          transform: [{ scale: pulse2Scale }],
          opacity: pulse2Opacity
        }]} />

        {/* Pulse 1 (inner) */}
        <Animated.View style={[styles.pulseRing, {
          borderWidth: 2,
          borderColor: `rgba(${LOGO_COLOR_RGB}, 0.4)`,
          transform: [{ scale: pulse1Scale }],
          opacity: pulse1Opacity
        }]} />

        {/* Logo with subtle rocking animation */}
        <Animated.View style={{
          transform: [
            { scale: logoScale },
            { rotate: logoRotate }
          ],
          opacity: logoOpacity,
          zIndex: 10,
        }}>
          <Image
            source={require('../../splash-ratedeed.png')}
            style={{ width: 110, height: 110 }}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Wordmark */}
        <Animated.View style={{
          opacity: wordmarkOpacity,
          transform: [{ translateY: wordmarkY }],
          marginTop: 28,
          zIndex: 10,
        }}>
          <Text style={[styles.wordmark, { color: wordmarkColor }]}>ratedeed</Text>
          <Text style={[styles.tagline, { color: isDark ? '#a3a3a3' : '#737373' }]}>for contractors</Text>
        </Animated.View>
      </View>

      {/* Bouncing dots — synchronized staggered wave */}
      <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity }]}>
        <BouncingDotsLoader size="large" color={dotColor} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    top: '50%',
    left: '50%',
    marginLeft: -250,
    marginTop: -250,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 72,
    alignItems: 'center',
    width: '100%',
  },
  dotsWrapper: {
    flexDirection: 'row',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  }
});

export default LoadingScreen;