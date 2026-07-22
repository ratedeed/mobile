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
const THIRTY_MINUTES_MS = 1000;

/* ────────────────────────────────────────────────────────────────
   Mobile Stardust Settings
   ──────────────────────────────────────────────────────────────── */
const WAVE_DURATION = 1250;
const SLICE_COUNT = 14;
const PARTICLE_COUNT = Platform.OS === 'ios' ? 160 : 125;
const CLEANUP_DELAY = WAVE_DURATION + 2350;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

function pickDustColor() {
  const r = Math.random();

  if (r < 0.52) return '#E9EDFF'; // ice-blue mist
  if (r < 0.74) return '#E0E7FF'; // soft indigo mist
  if (r < 0.86) return '#C7D2FE'; // light indigo dust
  if (r < 0.94) return '#A5B4FC'; // indigo shimmer
  if (r < 0.98) return '#6366F1'; // strong indigo
  return '#1F2937'; // dark text dust
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SliceAnim {
  id: number;
  transX: Animated.Value;
  transY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  delay: number;
  duration: number;
  toX: number;
  toY: number;
}

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

export const EscrowTrustBanner = () => {
  const [visible, setVisible] = useState(false);
  const [isDisintegrating, setIsDisintegrating] = useState(false);
  const [fxVersion, setFxVersion] = useState(0);
  const [bannerLayout, setBannerLayout] = useState<BannerLayout | null>(null);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

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

  const sliceAnimsRef = useRef<SliceAnim[]>([]);
  const particleAnimsRef = useRef<ParticleAnim[]>([]);
  const bannerLayoutRef = useRef<BannerLayout | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hammerLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const onBannerLayout = useCallback((e: LayoutChangeEvent) => {
    const layout = e.nativeEvent.layout;
    const next = {
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

  const createSlices = useCallback((width: number) => {
    const slices: SliceAnim[] = [];

    for (let i = 0; i < SLICE_COUNT; i++) {
      const progress = i / SLICE_COUNT;

      slices.push({
        id: i,
        transX: new Animated.Value(0),
        transY: new Animated.Value(0),
        opacity: new Animated.Value(1),
        scale: new Animated.Value(1),
        delay: progress * WAVE_DURATION + rand(0, 90),
        duration: rand(680, 980),
        toX: rand(6, 26) + progress * 14,
        toY: -rand(16, 58),
      });
    }

    sliceAnimsRef.current = slices;
  }, []);

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
        delay: Math.max(0, progress * WAVE_DURATION + rand(-50, 140)),
        duration: rand(950, 1700),
        toX: rand(8, 44) + progress * 18,
        toY: -(rand(18, 84) + progress * 12),
      });
    }

    particleAnimsRef.current = particles;
  }, []);

  const animateSlices = useCallback(() => {
    const anims = sliceAnimsRef.current.map((slice) =>
      Animated.sequence([
        Animated.delay(slice.delay),
        Animated.parallel([
          Animated.timing(slice.transX, {
            toValue: slice.toX,
            duration: slice.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slice.transY, {
            toValue: slice.toY,
            duration: slice.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slice.opacity, {
            toValue: 0,
            duration: slice.duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(slice.scale, {
            toValue: 0.96,
            duration: slice.duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.parallel(anims).start();
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

  const animateWave = useCallback((width: number) => {
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
  }, [waveX, waveOpacity]);

  const show = useCallback(() => {
    if (cleanupTimer.current) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }

    stopHammer();
    resetTextAnimations();

    sliceAnimsRef.current = [];
    particleAnimsRef.current = [];
    setIsDisintegrating(false);
    setFxVersion((v) => v + 1);

    slideAnim.setValue(300);
    bannerOpacity.setValue(0);
    backdropOpacity.setValue(0);
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
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
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
    backdropOpacity,
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
    if (isDisintegrating) return;

    setIsDisintegrating(true);
    stopHammer();

    AsyncStorage.setItem(ESCROW_BANNER_KEY, Date.now().toString()).catch(() => {});

    const layout = bannerLayoutRef.current;
    const fallbackWidth = Math.min(SCREEN_WIDTH - 32, 520);
    const width = layout?.width || fallbackWidth;
    const height = layout?.height || 88;

    createSlices(width);
    createParticles(width, height);
    setFxVersion((v) => v + 1);

    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();

    requestAnimationFrame(() => {
      animateWave(width);
      animateSlices();
      animateParticles();
    });

    cleanupTimer.current = setTimeout(() => {
      setVisible(false);
      setIsDisintegrating(false);

      sliceAnimsRef.current = [];
      particleAnimsRef.current = [];
      setFxVersion((v) => v + 1);

      resetTextAnimations();

      hammerRotate.setValue(0);
      hammerY.setValue(0);
      slideAnim.setValue(300);
      bannerOpacity.setValue(0);
      backdropOpacity.setValue(0);
      waveOpacity.setValue(0);
    }, CLEANUP_DELAY);
  }, [
    isDisintegrating,
    backdropOpacity,
    createSlices,
    createParticles,
    animateWave,
    animateSlices,
    animateParticles,
    resetTextAnimations,
    hammerRotate,
    hammerY,
    slideAnim,
    bannerOpacity,
    waveOpacity,
    stopHammer,
  ]);

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
      stopHammer();

      if (cleanupTimer.current) {
        clearTimeout(cleanupTimer.current);
      }
    };
  }, [show, stopHammer]);

  if (!visible) return null;

  const rotateInterpolate = hammerRotate.interpolate({
    inputRange: [-35, 0],
    outputRange: ['-35deg', '0deg'],
  });

  const layoutForFx = bannerLayoutRef.current;
  const sliceWidth = layoutForFx ? layoutForFx.width / SLICE_COUNT : 0;

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

      <Pressable onPress={dismiss} style={styles.closeButton}>
        <FontAwesome5 name="times" size={18} color="#A3A3A3" />
      </Pressable>
    </View>
  );

  const renderStaticContent = () => (
    <View style={styles.content}>
      <View style={styles.iconContainer}>
        <Image
          source={require('../../assets/logo-hammer.png')}
          style={{ width: 44, height: 44, resizeMode: 'contain' }}
        />
      </View>

      <View style={styles.textContainer}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          <Text style={styles.text}>Your money is held in </Text>
          <Text style={[styles.text, { color: '#6366F1', fontWeight: '800' }]}>escrow </Text>
          <Text style={styles.text}>until the job is done right.</Text>
        </View>
      </View>
    </View>
  );

  return (
    <>
      {/* Backdrop */}
      <AnimatedPressable
        style={[styles.overlay, { opacity: backdropOpacity }]}
        onPress={dismiss}
      />

      {/* Banner positioner */}
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
          {/* Real banner (hidden during disintegration) */}
          <View
            style={[
              styles.banner,
              {
                opacity: isDisintegrating ? 0 : 1,
              },
            ]}
            onLayout={onBannerLayout}
            pointerEvents={isDisintegrating ? 'none' : 'auto'}
          >
            {renderLiveContent()}
          </View>

          {/* Disintegration FX layer */}
          {isDisintegrating && layoutForFx && sliceWidth > 0 && (
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
              {/* Slices */}
              {sliceAnimsRef.current.map((slice, i) => (
                <View
                  key={`slice-${slice.id}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: i * sliceWidth,
                    width: sliceWidth,
                    overflow: 'hidden',
                  }}
                >
                  <Animated.View
                    style={{
                      width: layoutForFx.width,
                      height: layoutForFx.height,
                      backgroundColor: '#FFFFFF',
                      borderTopLeftRadius: 32,
                      borderTopRightRadius: 32,
                      paddingVertical: 28,
                      paddingHorizontal: 24,
                      opacity: slice.opacity,
                      transform: [
                        { translateX: -i * sliceWidth },
                        { translateX: slice.transX },
                        { translateY: slice.transY },
                        { scale: slice.scale },
                      ],
                    }}
                  >
                    {renderStaticContent()}
                  </Animated.View>
                </View>
              ))}

              {/* Wavefront */}
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