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
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  Svg,
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ESCROW_BANNER_KEY = '@escrow_banner_dismissed_at';

/*
  FIX:
  Use a real cooldown.
  Do not use 1000ms here unless you want the banner to reappear constantly.
*/
const COOLDOWN_MS = 10000;

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
const PARTICLE_COUNT = Platform.OS === 'ios' ? 180 : 130;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

function pickDustColor() {
  const r = Math.random();

  if (r < 0.52) return '#E9EDFF';
  if (r < 0.74) return '#E0E7FF';
  if (r < 0.86) return '#C7D2FE';
  if (r < 0.94) return '#A5B4FC';
  if (r < 0.98) return '#6366F1';
  return '#1F2937';
}

function pickSparkleColor() {
  return Math.random() > 0.5 ? '#FFFFFF' : '#E0E7FF';
}

/* ────────────────────────────────────────────────────────────────
   Animated Gradient Text
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

        <SvgText fill="url(#grad)" fontSize="17" fontWeight="800" x="0" y="18">
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

  /*
    FIX:
    This prevents repeated show/dismiss cycles.
  */
  const bannerPhase = useRef<BannerPhase>('hidden');
  const isMountedRef = useRef(true);

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
            toValue: -35,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 4,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: 0,
            duration: 180,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: -20,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 2,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(hammerRotate, {
            toValue: 0,
            duration: 150,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
          Animated.timing(hammerY, {
            toValue: 0,
            duration: 150,
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
      const y = Math.random() * Math.max(40, height - 18) + 8;
      const progress = x / width;

      const isSparkle = Math.random() < 0.14;

      const size = isSparkle
        ? rand(1.4, 2.6)
        : Math.random() < 0.76
          ? rand(1.5, 3.0)
          : rand(3.0, 4.6);

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
        delay: Math.max(0, progress * WAVE_DURATION + rand(-30, 120)),
        duration: rand(900, 1500),
        toX: rand(8, 44) + progress * 18,
        toY: -(rand(18, 84) + progress * 12),
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
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!isMountedRef.current) return;
      if (bannerPhase.current !== 'visible') return;

      startHammerAnimation();

      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(text1Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(text1Y, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(text2Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(text2Y, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(text3Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(text3Y, {
            toValue: 0,
            duration: 400,
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

    setIsDisintegrating(true);
    stopHammer();

    AsyncStorage.setItem(ESCROW_BANNER_KEY, Date.now().toString()).catch(() => {});

    const fallbackWidth = Math.min(SCREEN_WIDTH - 32, 520);

    const layout: BannerLayout =
      bannerLayoutRef.current || {
        x: 0,
        y: 0,
        width: fallbackWidth,
        height: 88,
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
  ]);

  /*
    FIX:
    Safe event-driven show logic.
    No full-screen backdrop.
    No aggressive polling.
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
      checkAndShow
    );

    // Initial check on mount
    checkAndShow();

    let interval: ReturnType<typeof setInterval> | undefined;

    if (ENABLE_PERIODIC_RECHECK) {
      interval = setInterval(checkAndShow, RECHECK_INTERVAL_MS);
    }

    return () => {
      subscription.remove();

      if (interval) {
        clearInterval(interval);
      }

      stopHammer();

      if (cleanupTimer.current) {
        clearTimeout(cleanupTimer.current);
        cleanupTimer.current = null;
      }
    };
  }, [show, stopHammer]);

  if (!visible) return null;

  const rotateInterpolate = hammerRotate.interpolate({
    inputRange: [-35, 0],
    outputRange: ['-35deg', '0deg'],
  });

  const layoutForFx = bannerLayout;

  const renderLiveContent = () => (
    <View style={styles.content}>
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
          style={{ width: 44, height: 44, resizeMode: 'contain' }}
        />
      </Animated.View>

      <View style={styles.textContainer}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          <Animated.View
            style={{ opacity: text1Opacity, transform: [{ translateY: text1Y }] }}
          >
            <Text style={styles.text}>Your money is held in </Text>
          </Animated.View>

          <Animated.View
            style={{ opacity: text2Opacity, transform: [{ translateY: text2Y }] }}
          >
            <AnimatedGradientText text="escrow " />
          </Animated.View>

          <Animated.View
            style={{ opacity: text3Opacity, transform: [{ translateY: text3Y }] }}
          >
            <Text style={styles.text}>until the job is done right.</Text>
          </Animated.View>
        </View>
      </View>

      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        style={styles.closeButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <FontAwesome5 name="times" size={18} color="#A3A3A3" />
      </Pressable>
    </View>
  );

  return (
    /*
      FIX:
      Root is pass-through.
      Only the banner card itself receives touches.
    */
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.bannerPositioner,
          {
            transform: [{ translateY: slideAnim }],
            opacity: bannerOpacity,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Interactive banner card */}
        <Animated.View
          pointerEvents={isDisintegrating ? 'none' : 'auto'}
          style={{
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
            {/* Wavefront halo */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: -12,
                width: 24,
                opacity: waveOpacity,
                transform: [{ translateX: waveX }],
                backgroundColor: 'rgba(129,140,248,0.14)',
              }}
            />

            {/* Wavefront line */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: -1,
                width: 2,
                opacity: waveOpacity,
                transform: [{ translateX: waveX }],
                backgroundColor: 'rgba(99,102,241,0.42)',
              }}
            />

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
    bottom: 0,
    left: 0,
    right: 0,
  },
  banner: {
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