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
// Generates a dense grid mapped to the banner size, emulating WebGL texture sampling
const generateParticles = () => {
  const particles = [];
  const grid = 12; // Density of the particle grid
  let id = 0;

  for (let y = 10; y < 110; y += grid) {
    for (let x = 10; x < BANNER_WIDTH - 10; x += grid) {
      // Approximate the color of the UI at this specific coordinate
      let color = '#E9EDFF'; // Base background stardust (Ice Blue)

      if (x < 80) {
        // Hammer Logo Area
        color = '#4F46E5';
      } else if (x > 90 && x < BANNER_WIDTH * 0.4) {
        // "Your money is held in"
        color = '#1C1B1F';
      } else if (x > BANNER_WIDTH * 0.4 && x < BANNER_WIDTH * 0.55) {
        // "escrow" Indigo Shimmer
        color = Math.random() > 0.4 ? '#4F46E5' : '#6366F1';
      } else if (x > BANNER_WIDTH * 0.55) {
        // "until the job is done right."
        color = '#1C1B1F';
      }

      // 30% chance to mix in icy background dust for the "floaty" feel
      if (Math.random() < 0.3) {
        color = '#E9EDFF';
      }

      particles.push({
        id: id++,
        baseX: x + (Math.random() - 0.5) * 8,
        baseY: y + (Math.random() - 0.5) * 8,
        size: Math.random() * 3 + 1.5,
        color,
        delay: (x / BANNER_WIDTH) * 700, // Left-to-right wave sweep
        life: 1200 + Math.random() * 600, // 1.2s to 1.8s lifespan
        driftX: 25 + Math.random() * 50,
        driftY: 60 + Math.random() * 80,
        transX: new Animated.Value(0),
        transY: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(1),
      });
    }
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
  const waveX = useRef(new Animated.Value(0)).current; // Wavefront sweep
  
  // Staggered text animations
  const text1Opacity = useRef(new Animated.Value(0)).current;
  const text1Y = useRef(new Animated.Value(10)).current;
  const text2Opacity = useRef(new Animated.Value(0)).current;
  const text2Y = useRef(new Animated.Value(10)).current;
  const text3Opacity = useRef(new Animated.Value(0)).current;
  const text3Y = useRef(new Animated.Value(10)).current;

  const particlesRef = useRef(generateParticles());

  // Exact 1.8s RateDeed double-tap hammer sequence
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
    
    // Reset particles
    particlesRef.current.forEach((p) => {
      p.transX.setValue(0);
      p.transY.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(1);
    });

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
  }, [slideAnim, opacityAnim, startHammerAnimation, text1Opacity, text1Y, text2Opacity, text2Y, text3Opacity, text3Y]);

  // WebGL-matched Sweeping Stardust Disintegration Dismissal
  const dismiss = useCallback(() => {
    if (isDisintegrating) return;
    setIsDisintegrating(true);
    AsyncStorage.setItem(ESCROW_BANNER_KEY, Date.now().toString()).catch(() => {});

    // Fade main banner card quickly to simulate the mask opening
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 400, 
      useNativeDriver: true,
    }).start();

    // Sweep the wavefront glow across the banner
    Animated.timing(waveX, {
      toValue: 1,
      duration: 800,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Trigger particle animations sequentially from left to right
    const particleAnimations = particlesRef.current.map((p) => {
      p.opacity.setValue(1);
      p.scale.setValue(1);

      return Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          // Airy upward drift matched from WebGL shader
          Animated.timing(p.transY, {
            toValue: -p.driftY,
            duration: p.life,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Rightward drift matched from WebGL shader
          Animated.timing(p.transX, {
            toValue: p.driftX,
            duration: p.life,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Scale pops up slightly then fades to dust
          Animated.sequence([
            Animated.timing(p.scale, {
              toValue: 1.6,
              duration: p.life * 0.3,
              useNativeDriver: true,
            }),
            Animated.timing(p.scale, {
              toValue: 0,
              duration: p.life * 0.7,
              useNativeDriver: true,
            }),
          ]),
          // Opacity fades out over lifespan
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: p.life,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(particleAnimations).start(() => {
      setVisible(false);
      setIsDisintegrating(false);
      text1Opacity.setValue(0); text1Y.setValue(10);
      text2Opacity.setValue(0); text2Y.setValue(10);
      text3Opacity.setValue(0); text3Y.setValue(10);
      hammerRotate.setValue(0); slideAnim.setValue(300);
      waveX.setValue(0);
    });
  }, [isDisintegrating, opacityAnim, slideAnim, text1Opacity, text1Y, text2Opacity, text2Y, text3Opacity, text3Y, hammerRotate, waveX]);

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

  const waveTranslateX = waveX.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, BANNER_WIDTH + 50],
  });

  return (
    <>
      <AnimatedPressable style={[styles.overlay, { opacity: opacityAnim }]} onPress={dismiss} />

      <View style={styles.container} pointerEvents="box-none">
        {/* Render Floating Native Stardust Particles Layer */}
        {isDisintegrating && (
          <View style={styles.particleContainer} pointerEvents="none">
            {/* WebGL Wavefront Glow Simulation */}
            <Animated.View
              style={[
                styles.waveGlow,
                { transform: [{ translateX: waveTranslateX }] },
              ]}
            />
            
            {particlesRef.current.map((p) => (
              <Animated.View
                key={p.id}
                style={[
                  styles.particle,
                  {
                    left: p.baseX,
                    top: p.baseY,
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    backgroundColor: p.color,
                    opacity: p.opacity,
                    transform: [
                      { translateX: p.transX },
                      { translateY: p.transY },
                      { scale: p.scale },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        )}

        <Animated.View
          style={[
            styles.banner,
            {
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
            }
          ]}
          pointerEvents="auto"
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

            <Pressable onPress={dismiss} style={styles.closeButton}>
              <FontAwesome5 name="times" size={18} color="#A3A3A3" />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  particleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140, // Matches the generation grid height
    maxWidth: BANNER_WIDTH,
    alignSelf: 'center',
    zIndex: 99999,
  },
  waveGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(129, 140, 248, 0.9)',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 10,
  },
  particle: {
    position: 'absolute',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
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