import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  StyleSheet,
  Easing,
  DeviceEventEmitter,
  Image,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Svg, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ESCROW_BANNER_KEY = '@escrow_banner_dismissed_at';
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const BANNER_WIDTH = Math.min(SCREEN_WIDTH - 32, 520);

// ---- Animated Gradient Text Component ----
const AnimatedGradientText = ({ text }: { text: string }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View style={{ width: 70, height: 24 }}>
      <Svg height="24" width="70" viewBox="0 0 70 24">
        <Defs>
          <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#4F46E5" />
            <Stop offset="25%" stopColor="#6366F1" />
            <Stop offset="50%" stopColor="#A5B4FC" />
            <Stop offset="75%" stopColor="#6366F1" />
            <Stop offset="100%" stopColor="#4F46E5" />
          </SvgGradient>
        </Defs>
        <Animated.View style={{ transform: [{ translateX }] }}>
          <Rect x="-100" y="0" width="300" height="24" fill="url(#grad)" />
        </Animated.View>
        <SvgText
          fill="url(#grad)"
          fontSize="17"
          fontWeight="800"
          x="0"
          y="18"
        >
          {text}
        </SvgText>
      </Svg>
    </View>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---- Native Stardust Particle System ----
const TOTAL_PARTICLES = 60;
const generateParticles = () => {
  const particles = [];
  for (let i = 0; i < TOTAL_PARTICLES; i++) {
    const x = Math.random() * BANNER_WIDTH;
    const y = Math.random() * 80 + 10; // Spread vertically
    
    // Simulate WebGL Texture Sampling (Mapping UI colors to coordinates)
    let color = '#E9EDFF'; // 60% Base Ice-Blue Background Dust
    const colorRoll = Math.random();
    if (colorRoll > 0.6) {
      if (x < 80) color = '#4F46E5'; // Hammer Logo Area
      else if (x > BANNER_WIDTH * 0.4 && x < BANNER_WIDTH * 0.55) color = '#6366F1'; // Escrow Text
      else color = '#1C1B1F'; // Dark Text Dust
    }

    const start = (x / BANNER_WIDTH) * 0.7;
    const end = Math.min(1, start + 0.3);

    particles.push({
      id: i,
      x,
      y,
      size: Math.random() * 3 + 2, // 2px to 5px
      color,
      start,
      end,
      driftX: 30 + Math.random() * 50, // Rightward drift
      driftY: 50 + Math.random() * 60, // Upward airy lift
    });
  }
  return particles;
};

export const EscrowTrustBanner = () => {
  const [visible, setVisible] = useState(false);
  const [isDisintegrating, setIsDisintegrating] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hammerRotate = useRef(new Animated.Value(0)).current;
  const hammerY = useRef(new Animated.Value(0)).current;
  
  // Single native driver for the entire disintegration effect
  const dismissProgress = useRef(new Animated.Value(0)).current;
  
  const particlesRef = useRef(generateParticles());

  // Staggered text animations
  const text1Opacity = useRef(new Animated.Value(0)).current;
  const text1Y = useRef(new Animated.Value(10)).current;
  const text2Opacity = useRef(new Animated.Value(0)).current;
  const text2Y = useRef(new Animated.Value(10)).current;
  const text3Opacity = useRef(new Animated.Value(0)).current;
  const text3Y = useRef(new Animated.Value(10)).current;

  // Exact RateDeed double-tap hammer sequence
  const startHammerAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(hammerRotate, { toValue: -35, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hammerY, { toValue: 4, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, { toValue: 0, duration: 180, easing: Easing.bounce, useNativeDriver: true }),
          Animated.timing(hammerY, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, { toValue: -20, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hammerY, { toValue: 2, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, { toValue: 0, duration: 150, easing: Easing.bounce, useNativeDriver: true }),
          Animated.timing(hammerY, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]),
        Animated.delay(1000),
      ])
    ).start();
  }, [hammerRotate, hammerY]);

  const show = useCallback(() => {
    setVisible(true);
    setIsDisintegrating(false);
    dismissProgress.setValue(0);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startHammerAnimation();
      
      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(text1Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(text1Y, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(text2Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(text2Y, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(text3Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(text3Y, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [slideAnim, opacityAnim, startHammerAnimation, text1Opacity, text1Y, text2Opacity, text2Y, text3Opacity, text3Y, dismissProgress]);

  const dismiss = useCallback(() => {
    if (isDisintegrating) return;
    setIsDisintegrating(true);
    AsyncStorage.setItem(ESCROW_BANNER_KEY, Date.now().toString()).catch(() => {});

    Animated.timing(dismissProgress, {
      toValue: 1,
      duration: 1500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setIsDisintegrating(false);
      text1Opacity.setValue(0); text1Y.setValue(10);
      text2Opacity.setValue(0); text2Y.setValue(10);
      text3Opacity.setValue(0); text3Y.setValue(10);
      hammerRotate.setValue(0); slideAnim.setValue(300);
      dismissProgress.setValue(0);
    });
  }, [isDisintegrating, opacityAnim, slideAnim, text1Opacity, text1Y, text2Opacity, text2Y, text3Opacity, text3Y, hammerRotate, dismissProgress]);

  useEffect(() => {
    const checkAndShow = () => {
      AsyncStorage.getItem(ESCROW_BANNER_KEY)
        .then((val) => {
          if (val) {
            const dismissedAt = parseInt(val, 10);
            if (!isNaN(dismissedAt) && Date.now() - dismissedAt < THIRTY_MINUTES_MS) {
              return;
            }
          }
          show();
        })
        .catch(() => show());
    };

    const subscription = DeviceEventEmitter.addListener('show-escrow-banner', checkAndShow);
    const interval = setInterval(checkAndShow, THIRTY_MINUTES_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [show]);

  if (!visible) return null;

  const rotateInterpolate = hammerRotate.interpolate({
    inputRange: [-35, 0],
    outputRange: ['-35deg', '0deg'],
  });

  const waveTranslateX = dismissProgress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [-50, BANNER_WIDTH + 50, BANNER_WIDTH + 50],
    extrapolate: 'clamp',
  });
  const waveOpacity = dismissProgress.interpolate({
    inputRange: [0, 0.1, 0.6, 0.7, 1],
    outputRange: [0, 1, 1, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    // pointerEvents="box-none" allows touches to pass through to the background screen
    <View style={styles.container} pointerEvents="box-none">
      {/* Render Floating Native Stardust Particles Layer */}
      {isDisintegrating && (
        <View style={styles.particleContainer} pointerEvents="none">
          {/* WebGL Wavefront Glow Simulation */}
          <Animated.View
            style={[
              styles.waveGlow,
              { 
                transform: [{ translateX: waveTranslateX }],
                opacity: waveOpacity
              },
            ]}
          />
          
          {particlesRef.current.map((p) => {
            const pOpacity = dismissProgress.interpolate({
              inputRange: [p.start, p.start + 0.02, p.end],
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });

            const pScale = dismissProgress.interpolate({
              inputRange: [p.start, p.start + 0.1, p.end],
              outputRange: [0.5, 1.4, 0],
              extrapolate: 'clamp',
            });

            const pTransX = dismissProgress.interpolate({
              inputRange: [p.start, p.end],
              outputRange: [0, p.driftX],
              extrapolate: 'clamp',
            });

            const pTransY = dismissProgress.interpolate({
              inputRange: [p.start, p.end],
              outputRange: [0, -p.driftY],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={p.id}
                style={[
                  styles.particle,
                  {
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    backgroundColor: p.color,
                    opacity: pOpacity,
                    transform: [
                      { translateX: pTransX },
                      { translateY: pTransY },
                      { scale: pScale },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Only the banner itself captures touches. The background is completely scrollable. */}
      <AnimatedPressable 
        style={[
          styles.banner,
          {
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          }
        ]}
        onPress={dismiss}
      >
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { rotate: rotateInterpolate },
                  { translateY: hammerY },
                ],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo-hammer.png')}
              style={{ width: 44, height: 44, resizeMode: 'contain' }}
            />
          </Animated.View>

          <View style={styles.textContainer}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
              <Animated.View style={{ opacity: text1Opacity, transform: [{ translateY: text1Y }] }}>
                <Text style={styles.text}>Your money is held in </Text>
              </Animated.View>
              
              <Animated.View style={{ opacity: text2Opacity, transform: [{ translateY: text2Y }] }}>
                <AnimatedGradientText text="escrow " />
              </Animated.View>
              
              <Animated.View style={{ opacity: text3Opacity, transform: [{ translateY: text3Y }] }}>
                <Text style={styles.text}>until the job is done right.</Text>
              </Animated.View>
            </View>
          </View>

          {/* Specific close button to prevent accidental dismissals when tapping the banner */ }
          <Pressable onPress={dismiss} style={styles.closeButton}>
            <FontAwesome5 name="times" size={18} color="#A3A3A3" />
          </Pressable>
        </View>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  // 'box-none' ensures the wrapper doesn't block scrolling, only the visible children capture touches
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  particleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    maxWidth: BANNER_WIDTH,
    alignSelf: 'center',
    zIndex: 99999,
  },
  waveGlow: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 4,
    backgroundColor: '#818CF8',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  particle: {
    position: 'absolute',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 4,
  },
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  text: {
    fontSize: 17,
    color: '#1f2937',
    lineHeight: 24,
  },
  closeButton: {
    position: 'absolute',
    top: -12,
    right: -8,
    padding: 12,
  },
});