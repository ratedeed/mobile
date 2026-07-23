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
  Platform,
  LayoutChangeEvent,
  PanResponder,
} from 'react-native';
import {
  Svg,
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ESCROW_BANNER_KEY = 'ratedeed_escrow_banner_dismissed_at';
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes cooldown

/*
  Periodic recheck is disabled by default because it is safer.
  If you need it, enable it and keep the interval long.
*/
const ENABLE_PERIODIC_RECHECK = false;
const RECHECK_INTERVAL_MS = 60 * 1000;

/*
  Animation settings
*/
const WAVE_DURATION = 700;
const CARD_EXIT_DURATION = 700;
const CLEANUP_DELAY = 2600;
const PARTICLE_COUNT = Platform.OS === 'ios' ? 360 : 240;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

function pickDustColor() {
  const r = Math.random();

  if (r < 0.45) return '#F0F4FF';
  if (r < 0.70) return '#E0E7FF';
  if (r < 0.84) return '#C7D2FE';
  if (r < 0.93) return '#A5B4FC';
  if (r < 0.98) return '#6366F1';
  return '#1E1B4B';
}

function pickSparkleColor() {
  const r = Math.random();
  if (r < 0.60) return '#FFFFFF';
  if (r < 0.85) return '#E0E7FF';
  return '#C7D2FE';
}

let hasBannerBeenRequested = false;

DeviceEventEmitter.addListener('show-escrow-banner', () => {
  hasBannerBeenRequested = true;
});

/* ────────────────────────────────────────────────────────────────
   Animated Gradient Text (Web-Matching Shimmer Gradient)
   ──────────────────────────────────────────────────────────────── */
const AnimatedGradientText = ({ text }: { text: string }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => loop.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 90],
  });

  return (
    <View style={{ width: 54, height: 21, justifyContent: 'center', marginHorizontal: 2 }}>
      <Svg height="21" width="54" viewBox="0 0 54 21">
        <Defs>
          <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#4F46E5" />
            <Stop offset="25%" stopColor="#6366F1" />
            <Stop offset="50%" stopColor="#818CF8" />
            <Stop offset="75%" stopColor="#6366F1" />
            <Stop offset="100%" stopColor="#4F46E5" />
          </SvgGradient>
        </Defs>

        <Animated.View style={{ transform: [{ translateX }] }}>
          <Rect x="-90" y="0" width="270" height="21" fill="url(#grad)" />
        </Animated.View>

        <SvgText fill="url(#grad)" fontSize="14.5" fontWeight="800" x="0" y="16">
          {text}
        </SvgText>
      </Svg>
    </View>
  );
};

interface ParticleAnim {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  isSparkle: boolean;
  transX: Animated.Value;
  transY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  delay: number;
  duration: number;
  toX: number;
  toY: number;
}

interface BannerLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

type BannerPhase = 'hidden' | 'visible' | 'dismissing';

export const EscrowTrustBanner = () => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [isDisintegrating, setIsDisintegrating] = useState(false);
  const [fxVersion, setFxVersion] = useState(0);
  const [bannerLayout, setBannerLayout] = useState<BannerLayout | null>(null);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  const hammerRotate = useRef(new Animated.Value(0)).current;
  const hammerY = useRef(new Animated.Value(0)).current;

  const text1Opacity = useRef(new Animated.Value(0)).current;
  const text1Y = useRef(new Animated.Value(10)).current;
  const text2Opacity = useRef(new Animated.Value(0)).current;
  const text2Y = useRef(new Animated.Value(10)).current;
  const text3Opacity = useRef(new Animated.Value(0)).current;
  const text3Y = useRef(new Animated.Value(10)).current;

  const waveX = useRef(new Animated.Value(0)).current;
  const waveOpacity = useRef(new Animated.Value(0)).current;

  const particleAnimsRef = useRef<ParticleAnim[]>([]);
  const bannerLayoutRef = useRef<BannerLayout | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hammerLoopRef = useRef<ReturnType<typeof Animated.loop> | null>(null);

  const bannerPhase = useRef<BannerPhase>('hidden');
  const isMountedRef = useRef(true);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        if (bannerPhase.current === 'visible') {
          dismiss();
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        if (bannerPhase.current === 'visible') {
          dismiss();
        }
        return false;
      },
    })
  ).current;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const onBannerLayout = useCallback((e: LayoutChangeEvent) => {
    const layout = e.nativeEvent.layout;

    const next: BannerLayout = {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    };

    bannerLayoutRef.current = next;
    setBannerLayout(next);
  }, []);

  const stopHammer = useCallback(() => {
    hammerLoopRef.current?.stop();
    hammerLoopRef.current = null;
  }, []);

  const startHammerAnimation = useCallback(() => {
    stopHammer();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: -30,
            duration: 192,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 3,
            duration: 192,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: 0,
            duration: 192,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 0,
            duration: 192,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: -16,
            duration: 192,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 2,
            duration: 192,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: 0,
            duration: 192,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 0,
            duration: 192,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: -6,
            duration: 192,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: 0,
            duration: 640,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1000),
      ])
    );

    hammerLoopRef.current = loop;
    loop.start();
  }, [hammerRotate, hammerY, stopHammer]);

  const resetTextAnimations = useCallback(() => {
    text1Opacity.setValue(0);
    text1Y.setValue(10);
    text2Opacity.setValue(0);
    text2Y.setValue(10);
    text3Opacity.setValue(0);
    text3Y.setValue(10);
  }, [text1Opacity, text1Y, text2Opacity, text2Y, text3Opacity, text3Y]);

  const createParticles = useCallback((width: number, height: number) => {
    const particles: ParticleAnim[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = Math.random() * width;
      const y = Math.random() * Math.max(36, height - 12) + 6;
      const progress = x / width;

      const isSparkle = Math.random() < 0.22;
      const isFineDust = Math.random() < 0.65;

      const size = isSparkle
        ? rand(1.0, 2.2)
        : isFineDust
          ? rand(0.8, 1.8)
          : rand(2.0, 3.4);

      particles.push({
        id: i,
        x,
        y,
        size,
        color: isSparkle ? pickSparkleColor() : pickDustColor(),
        isSparkle,
        transX: new Animated.Value(0),
        transY: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.85),
        delay: Math.max(0, progress * WAVE_DURATION + rand(-40, 140)),
        duration: rand(850, 1600),
        toX: rand(10, 52) + progress * 22,
        toY: -(rand(16, 95) + progress * 16),
      });
    }

    particleAnimsRef.current = particles;
  }, []);

  const animateParticles = useCallback(() => {
    const anims = particleAnimsRef.current.map((p) => {
      const moveDuration = p.duration;

      const fadeOutDuration = p.isSparkle
        ? Math.max(220, moveDuration - 390)
        : Math.max(250, moveDuration - 80);

      const opacityAnimation = p.isSparkle
        ? Animated.sequence([
            Animated.delay(p.delay),
            Animated.timing(p.opacity, {
              toValue: 1,
              duration: 70,
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 0.35,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: fadeOutDuration,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ])
        : Animated.sequence([
            Animated.delay(p.delay),
            Animated.timing(p.opacity, {
              toValue: 1,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: fadeOutDuration,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]);

      return Animated.parallel([
        opacityAnimation,
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(p.transX, {
              toValue: p.toX,
              duration: moveDuration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(p.transY, {
              toValue: p.toY,
              duration: moveDuration,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(p.scale, {
                toValue: p.isSparkle ? 1.5 : 1.2,
                duration: Math.min(280, moveDuration * 0.3),
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(p.scale, {
                toValue: 0.25,
                duration: moveDuration * 0.7,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
      ]);
    });

    Animated.parallel(anims).start();
  }, []);

  const animateWave = useCallback(
    (width: number) => {
      waveX.setValue(0);
      waveOpacity.setValue(1);

      Animated.parallel([
        Animated.timing(waveX, {
          toValue: width,
          duration: WAVE_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(WAVE_DURATION * 0.68),
          Animated.timing(waveOpacity, {
            toValue: 0,
            duration: WAVE_DURATION * 0.32,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [waveX, waveOpacity]
  );

  const show = useCallback(() => {
    if (bannerPhase.current !== 'hidden') return;

    bannerPhase.current = 'visible';

    if (cleanupTimer.current) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }

    stopHammer();
    resetTextAnimations();

    particleAnimsRef.current = [];

    setIsDisintegrating(false);
    setFxVersion((v) => v + 1);

    slideAnim.setValue(300);
    bannerOpacity.setValue(0);

    cardOpacity.setValue(1);
    cardScale.setValue(1);

    waveOpacity.setValue(0);

    setVisible(true);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!isMountedRef.current) return;
      if (bannerPhase.current !== 'visible') return;

      startHammerAnimation();

      Animated.stagger(120, [
        Animated.parallel([
          Animated.timing(text1Opacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(text1Y, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(text2Opacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(text2Y, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(text3Opacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(text3Y, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, [
    slideAnim,
    bannerOpacity,
    startHammerAnimation,
    resetTextAnimations,
    stopHammer,
    text1Opacity,
    text1Y,
    text2Opacity,
    text2Y,
    text3Opacity,
    text3Y,
    waveOpacity,
  ]);

  const dismiss = useCallback(() => {
    if (bannerPhase.current !== 'visible') return;

    bannerPhase.current = 'dismissing';

    if (cleanupTimer.current) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }

    // Stop any ongoing entrance/stagger animations immediately
    slideAnim.stopAnimation();
    bannerOpacity.stopAnimation();
    text1Opacity.stopAnimation();
    text2Opacity.stopAnimation();
    text3Opacity.stopAnimation();
    text1Y.stopAnimation();
    text2Y.stopAnimation();
    text3Y.stopAnimation();
    hammerRotate.stopAnimation();
    hammerY.stopAnimation();

    // Lock position and snap text opacities so particles crumble from full card layout
    slideAnim.setValue(0);
    bannerOpacity.setValue(1);
    text1Opacity.setValue(1);
    text2Opacity.setValue(1);
    text3Opacity.setValue(1);
    text1Y.setValue(0);
    text2Y.setValue(0);
    text3Y.setValue(0);

    setIsDisintegrating(true);
    stopHammer();

    AsyncStorage.setItem(ESCROW_BANNER_KEY, Date.now().toString()).catch(() => {});

    const fallbackWidth = Math.min(SCREEN_WIDTH - 32, 460);

    const layout: BannerLayout =
      bannerLayoutRef.current || {
        x: (SCREEN_WIDTH - fallbackWidth) / 2,
        y: 0,
        width: fallbackWidth,
        height: 76,
      };

    if (!bannerLayoutRef.current) {
      bannerLayoutRef.current = layout;
      setBannerLayout(layout);
    }

    const width = layout.width;
    const height = layout.height;

    createParticles(width, height);
    setFxVersion((v) => v + 1);

    /*
      Card exit:
      quick elegant fade + slight scale-down while particles emit
    */
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: CARD_EXIT_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.985,
        duration: CARD_EXIT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    animateWave(width);
    animateParticles();

    cleanupTimer.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      bannerPhase.current = 'hidden';

      setVisible(false);
      setIsDisintegrating(false);

      particleAnimsRef.current = [];
      setFxVersion((v) => v + 1);

      resetTextAnimations();

      hammerRotate.setValue(0);
      hammerY.setValue(0);
      slideAnim.setValue(300);
      bannerOpacity.setValue(0);

      cardOpacity.setValue(1);
      cardScale.setValue(1);

      waveOpacity.setValue(0);

      cleanupTimer.current = null;
    }, CLEANUP_DELAY);
  }, [
    createParticles,
    animateWave,
    animateParticles,
    resetTextAnimations,
    hammerRotate,
    hammerY,
    slideAnim,
    bannerOpacity,
    cardOpacity,
    cardScale,
    waveOpacity,
    stopHammer,
    text1Opacity,
    text1Y,
    text2Opacity,
    text2Y,
    text3Opacity,
    text3Y,
  ]);

  /*
    FIX:
    Safe event-driven show logic.
    Only shows when triggered by 'show-escrow-banner' event after contractors load.
  */
  useEffect(() => {
    const checkAndShow = async () => {
      if (!isMountedRef.current) return;
      if (bannerPhase.current !== 'hidden') return;

      try {
        const val = await AsyncStorage.getItem(ESCROW_BANNER_KEY);

        if (!isMountedRef.current) return;
        if (bannerPhase.current !== 'hidden') return;

        if (val) {
          const dismissedAt = parseInt(val, 10);

          if (!isNaN(dismissedAt) && Date.now() - dismissedAt < COOLDOWN_MS) {
            return;
          }
        }

        show();
      } catch {
        if (!isMountedRef.current) return;
        if (bannerPhase.current !== 'hidden') return;

        show();
      }
    };

    const subscription = DeviceEventEmitter.addListener(
      'show-escrow-banner',
      () => {
        hasBannerBeenRequested = true;
        checkAndShow();
      }
    );

    // If show-escrow-banner was already emitted (e.g. while splash screen was active before mount),
    // trigger checkAndShow now that we are mounted and contractors have loaded.
    if (hasBannerBeenRequested) {
      checkAndShow();
    }

    const dismissSubscription = DeviceEventEmitter.addListener(
      'dismiss-escrow-banner',
      () => {
        if (bannerPhase.current === 'visible') {
          dismiss();
        }
      }
    );

    let interval: ReturnType<typeof setInterval> | undefined;

    if (ENABLE_PERIODIC_RECHECK) {
      interval = setInterval(checkAndShow, RECHECK_INTERVAL_MS);
    }

    return () => {
      subscription.remove();
      dismissSubscription.remove();

      if (interval) {
        clearInterval(interval);
      }

      stopHammer();

      if (cleanupTimer.current) {
        clearTimeout(cleanupTimer.current);
        cleanupTimer.current = null;
      }
    };
  }, [show, dismiss, stopHammer]);

  if (!visible) return null;

  const rotateInterpolate = hammerRotate.interpolate({
    inputRange: [-30, 0],
    outputRange: ['-30deg', '0deg'],
  });

  const layoutForFx = bannerLayout;

  const renderLiveContent = () => (
    <View style={styles.content}>
      {/* Top Glass Highlight */}
      <View style={styles.glassHighlight} />

      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ rotate: rotateInterpolate }, { translateY: hammerY }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo-hammer.png')}
          style={{ width: 40, height: 40, resizeMode: 'contain' }}
        />
      </Animated.View>

      <View style={styles.textContainer}>
        <Animated.View
          style={{
            opacity: text1Opacity,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Text style={styles.text}>Your money is held in </Text>
          <AnimatedGradientText text="escrow" />
          <Text style={styles.text}> until the job is done right.</Text>
        </Animated.View>
      </View>
    </View>
  );

  const bottomOffset = 64 + insets.bottom + 12;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.bannerPositioner,
          {
            bottom: bottomOffset,
            transform: [{ translateY: slideAnim }],
            opacity: bannerOpacity,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Floating interactive banner card matching web reference layout */}
        <Animated.View
          pointerEvents={isDisintegrating ? 'none' : 'auto'}
          style={{
            width: '100%',
            maxWidth: 460,
            alignSelf: 'center',
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          }}
        >
          <Pressable
            style={styles.banner}
            onPress={dismiss}
            onLayout={onBannerLayout}
            disabled={isDisintegrating}
          >
            {renderLiveContent()}
          </Pressable>
        </Animated.View>

        {/* FX layer — completely pass-through */}
        {isDisintegrating && layoutForFx && (
          <View
            key={`fx-${fxVersion}`}
            style={{
              position: 'absolute',
              top: layoutForFx.y,
              left: layoutForFx.x,
              width: layoutForFx.width,
              height: layoutForFx.height,
            }}
            pointerEvents="none"
          >
            {/* Particles */}
            {particleAnimsRef.current.map((p) => (
              <Animated.View
                key={`particle-${p.id}`}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: p.y,
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
                }}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerPositioner: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  banner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(28, 27, 31, 0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
    maxWidth: 420,
    alignSelf: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1C1B1F',
    lineHeight: 21,
  },
});