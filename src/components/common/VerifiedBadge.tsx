import React, { useEffect, memo, useCallback, useId } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, {
  G,
  Circle,
  Rect,
  Polygon,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  ClipPath,
  Path,
  Text as SvgText,
  TextPath,
  Line,
  Ellipse,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const DURATION = 2600;
const HERO_SCALE = 3.6; // Full 3.6x HD Hero Pop

const SIZE_MAP: Record<string, number> = {
  sm: 28,
  md: 34,
  lg: 48,
};

// --- Easing Worklets ---
const easeOutExpo = (t: number) => {
  'worklet';
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

const easeOutBack = (t: number) => {
  'worklet';
  const c = 1.3;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const easeOutCubic = (t: number) => {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
};

const easeInOutCubic = (t: number) => {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const sub = (t: number, s: number, e: number) => {
  'worklet';
  return Math.max(0, Math.min(1, (t - s) / (e - s)));
};

export const VerifiedBadge = memo(function VerifiedBadge({
  size = 28,
  animate = true,
  variant,
  text,
  style,
  transformOrigin = 'top-left',
}: {
  size?: number | string;
  animate?: boolean;
  variant?: string;
  text?: string;
  style?: any;
  transformOrigin?: 'top-left' | 'top-right' | 'center';
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const uid = `vb_${rawId || 'def'}`;
  const finalSize = typeof size === 'string' ? SIZE_MAP[size] || 28 : size;
  const heroPx = Math.round(finalSize * HERO_SCALE);
  const restingRatio = 1 / HERO_SCALE;

  const progress = useSharedValue(animate ? 0 : 1.3);
  const isPlayingRef = React.useRef(false);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    progress.value = 0;
    progress.value = withTiming(
      1.3,
      {
        duration: DURATION * 1.3,
        easing: Easing.linear,
      },
      (finished) => {
        if (finished) {
          isPlayingRef.current = false;
        }
      }
    );
  }, [progress]);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        play();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      progress.value = 1.3;
    }
  }, [animate, play, progress]);

  // 1. Master Container Animation (HD Canvas Scaled & Anchor Locked)
  const masterAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    let currentRelativeScale = restingRatio;

    if (t < 0.15) {
      // Phase 1: Pop zoom out smoothly from resting size to Hero Scale (3.6x)
      const popProg = sub(t, 0, 0.15);
      currentRelativeScale = restingRatio + (1.0 - restingRatio) * easeOutBack(popProg);
    } else if (t < 0.80) {
      // Phase 2: Hold Hero Scale during Temple construction
      currentRelativeScale = 1.0;
    } else if (t < 1.05) {
      // Phase 3: Smoothly shrink back to resting badge size
      const shrinkProg = sub(t, 0.80, 1.05);
      currentRelativeScale = 1.0 - (1.0 - restingRatio) * easeInOutCubic(shrinkProg);
    } else {
      // Phase 4: Resting size
      currentRelativeScale = restingRatio;
    }

    const isHeroActive = t > 0.01 && t < 1.05;

    // Mathematically exact anchor calculations:
    let translateX = 0;
    let translateY = 0;

    if (transformOrigin === 'top-left') {
      // Anchors top-left at (0, 0) for all scales without clipping outside
      translateX = (heroPx * (currentRelativeScale - 1.0)) / 2;
      translateY = (heroPx * (currentRelativeScale - 1.0)) / 2;
    } else if (transformOrigin === 'top-right') {
      // Anchors top-right at (finalSize, 0)
      translateX = -(heroPx * (currentRelativeScale - 1.0)) / 2 - (heroPx - finalSize);
      translateY = (heroPx * (currentRelativeScale - 1.0)) / 2;
    } else {
      // Center origin: anchors at the exact center of the container
      translateX = -(heroPx - finalSize) / 2;
      translateY = -(heroPx - finalSize) / 2;
    }

    return {
      zIndex: isHeroActive ? 9999 : 20,
      elevation: isHeroActive ? 30 : 3,
      transform: [
        { translateX },
        { translateY },
        { scale: currentRelativeScale },
      ],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: isHeroActive ? 10 : 2 },
      shadowOpacity: isHeroActive ? 0.35 : 0.12,
      shadowRadius: isHeroActive ? 14 : 3,
    };
  });

  // 2. Foundation Base Animation
  const baseAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const buildBase = easeOutExpo(sub(t, 0.15, 0.35));
    return {
      opacity: sub(t, 0.12, 0.20),
      transform: [
        { translateY: (1 - buildBase) * (heroPx * 0.08) },
        { scaleY: Math.max(0.001, buildBase) },
      ],
    };
  });

  // 3. Base Dust Impact Burst
  const dustBaseAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const baseHit = sub(t, 0.32, 0.42);
    const opacity = baseHit > 0 && baseHit < 1 ? (1 - baseHit) * 0.95 : 0;
    const scale = baseHit > 0 && baseHit < 1 ? easeOutExpo(baseHit) * 1.5 : 0.001;
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // 4. Columns Sequential Rising Animation
  const col1AnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const buildCol1 = easeOutExpo(sub(t, 0.25, 0.45));
    return {
      opacity: sub(t, 0.22, 0.30),
      transform: [
        { translateY: (1 - buildCol1) * (heroPx * 0.12) },
        { scaleY: Math.max(0.001, buildCol1) },
      ],
    };
  });

  const col2AnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const buildCol2 = easeOutExpo(sub(t, 0.30, 0.50));
    return {
      opacity: sub(t, 0.27, 0.35),
      transform: [
        { translateY: (1 - buildCol2) * (heroPx * 0.12) },
        { scaleY: Math.max(0.001, buildCol2) },
      ],
    };
  });

  const col3AnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const buildCol3 = easeOutExpo(sub(t, 0.35, 0.55));
    return {
      opacity: sub(t, 0.32, 0.40),
      transform: [
        { translateY: (1 - buildCol3) * (heroPx * 0.12) },
        { scaleY: Math.max(0.001, buildCol3) },
      ],
    };
  });

  // 5. Column Dust Burst
  const dustColAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const colHit = sub(t, 0.52, 0.62);
    const opacity = colHit > 0 && colHit < 1 ? (1 - colHit) * 0.95 : 0;
    const scale = colHit > 0 && colHit < 1 ? easeOutExpo(colHit) * 1.5 : 0.001;
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // 6. Roof Pediment Snap Animation
  const roofAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const buildRoof = easeOutBack(sub(t, 0.45, 0.70));
    return {
      opacity: sub(t, 0.42, 0.50),
      transform: [
        { translateY: (1 - buildRoof) * -(heroPx * 0.15) },
        { scale: Math.max(0.001, buildRoof) },
      ],
    };
  });

  // 7. Roof Dust Burst
  const dustRoofAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const roofHit = sub(t, 0.65, 0.75);
    const opacity = roofHit > 0 && roofHit < 1 ? (1 - roofHit) * 0.95 : 0;
    const scale = roofHit > 0 && roofHit < 1 ? easeOutExpo(roofHit) * 1.5 : 0.001;
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // 8. Chiseled Arc Text Animation
  const textAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const textProg = sub(t, 0.65, 0.85);
    return {
      opacity: easeOutCubic(textProg),
      transform: [
        { scale: 1.15 - easeOutCubic(textProg) * 0.15 },
      ],
    };
  });

  // 9. Sweeping Gold Shine Glint Animation
  const shineAnimatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const shineProg = sub(t, 1.05, 1.25);
    const opacity = shineProg > 0 && shineProg < 1 ? 0.95 : 0;
    const translateX = -(heroPx * 1.2) + shineProg * (heroPx * 2.4);
    return {
      opacity,
      transform: [
        { translateX },
        { rotate: '35deg' },
      ],
    };
  });

  return (
    <Pressable
      onPress={play}
      hitSlop={8}
      style={[
        styles.anchorWrapper,
        { width: finalSize, height: finalSize },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.masterHeroCanvas,
          { width: heroPx, height: heroPx },
          masterAnimatedStyle,
        ]}
      >
        {/* Layer 0: Coin Background, Outer Beaded Rim & Milled Edges with 100% Solid Opaque Backing at Full Retina HD Resolution */}
        <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`badge-bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="60%" stopColor="#FAF7F0" />
              <Stop offset="100%" stopColor="#EAE5D9" />
            </LinearGradient>
            <LinearGradient id={`gold-grad-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FFECA8" />
              <Stop offset="25%" stopColor="#D4AF37" />
              <Stop offset="50%" stopColor="#AA7C11" />
              <Stop offset="75%" stopColor="#D4AF37" />
              <Stop offset="100%" stopColor="#8A6308" />
            </LinearGradient>
            <LinearGradient id={`gold-dark-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#B38B22" />
              <Stop offset="100%" stopColor="#755811" />
            </LinearGradient>
            <LinearGradient id={`gold-col-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#AA7C11" />
              <Stop offset="30%" stopColor="#FCE79A" />
              <Stop offset="70%" stopColor="#D4AF37" />
              <Stop offset="100%" stopColor="#755811" />
            </LinearGradient>
            <LinearGradient id={`shine-grad-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.9} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <Path id={`text-arc-${uid}`} d="M 6,50 A 44,44 0 0,0 94,50" />
          </Defs>

          {/* 100% Solid Opaque Backing (Guarantees NO background text/images ever show through) */}
          <Circle cx="50" cy="50" r="49.5" fill="#FAF7F0" />
          <Circle cx="50" cy="50" r="49" fill={`url(#badge-bg-${uid})`} />
          <Circle cx="50" cy="50" r="46.5" fill="none" stroke={`url(#gold-grad-${uid})`} strokeWidth={3.5} />
          <Circle cx="50" cy="50" r="44" fill="none" stroke={`url(#gold-grad-${uid})`} strokeWidth={0.6} opacity={0.6} />

          {/* Milled Gold Edge Ticks */}
          <G>
            {[...Array(48)].map((_, i) => {
              const a = (i / 48) * Math.PI * 2;
              const x1 = 50 + 42.5 * Math.cos(a);
              const y1 = 50 + 42.5 * Math.sin(a);
              const x2 = 50 + 44.5 * Math.cos(a);
              const y2 = 50 + 44.5 * Math.sin(a);
              return (
                <Line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={`url(#gold-grad-${uid})`}
                  strokeWidth={0.8}
                />
              );
            })}
          </G>

          <Circle cx="50" cy="50" r="35" fill="none" stroke={`url(#gold-dark-${uid})`} strokeWidth={0.75} />
          <Circle cx="50" cy="50" r="34.5" fill="#FAF7F0" />
          <Circle cx="50" cy="50" r="34.5" fill={`url(#badge-bg-${uid})`} />
        </Svg>

        {/* Layer 1: Chiseled Arc Text */}
        <Animated.View style={[StyleSheet.absoluteFill, textAnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Defs>
              <Path id={`text-arc-layer-${uid}`} d="M 6,50 A 44,44 0 0,0 94,50" />
            </Defs>
            <SvgText
              fontSize={6.4}
              fontWeight="bold"
              fill="#4A3100"
              letterSpacing={1.5}
              fontFamily="Georgia"
              textAnchor="middle"
            >
              <TextPath href={`#text-arc-layer-${uid}`} startOffset="50%">
                ✦ RATEDEED · VERIFIED ✦
              </TextPath>
            </SvgText>
          </Svg>
        </Animated.View>

        {/* Layer 2: Foundation Base */}
        <Animated.View style={[StyleSheet.absoluteFill, baseAnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`gold-grad-base-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#FFECA8" />
                <Stop offset="50%" stopColor="#D4AF37" />
                <Stop offset="100%" stopColor="#8A6308" />
              </LinearGradient>
              <LinearGradient id={`gold-dark-base-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#B38B22" />
                <Stop offset="100%" stopColor="#755811" />
              </LinearGradient>
            </Defs>
            <Rect x={32} y={62} width={36} height={2.5} rx={0.5} fill={`url(#gold-grad-base-${uid})`} />
            <Rect x={29} y={64.5} width={42} height={3} rx={0.5} fill={`url(#gold-dark-base-${uid})`} />
          </Svg>
        </Animated.View>

        {/* Layer 3: Column 1 (Left Pillar) */}
        <Animated.View style={[StyleSheet.absoluteFill, col1AnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`gold-col-1-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#AA7C11" />
                <Stop offset="30%" stopColor="#FCE79A" />
                <Stop offset="70%" stopColor="#D4AF37" />
                <Stop offset="100%" stopColor="#755811" />
              </LinearGradient>
              <LinearGradient id={`gold-grad-col1-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#FFECA8" />
                <Stop offset="100%" stopColor="#8A6308" />
              </LinearGradient>
            </Defs>
            <Rect x={35} y={49.5} width={4.5} height={11.5} fill={`url(#gold-col-1-${uid})`} />
            <Polygon points="34,48.5 40.5,48.5 39.5,49.5 35,49.5" fill={`url(#gold-grad-col1-${uid})`} />
            <Polygon points="35,61 39.5,61 40.5,62 34,62" fill={`url(#gold-grad-col1-${uid})`} />
          </Svg>
        </Animated.View>

        {/* Layer 4: Column 2 (Center Pillar) */}
        <Animated.View style={[StyleSheet.absoluteFill, col2AnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`gold-col-2-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#AA7C11" />
                <Stop offset="30%" stopColor="#FCE79A" />
                <Stop offset="70%" stopColor="#D4AF37" />
                <Stop offset="100%" stopColor="#755811" />
              </LinearGradient>
              <LinearGradient id={`gold-grad-col2-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#FFECA8" />
                <Stop offset="100%" stopColor="#8A6308" />
              </LinearGradient>
            </Defs>
            <Rect x={47.75} y={49.5} width={4.5} height={11.5} fill={`url(#gold-col-2-${uid})`} />
            <Polygon points="46.75,48.5 53.25,48.5 52.25,49.5 47.75,49.5" fill={`url(#gold-grad-col2-${uid})`} />
            <Polygon points="47.75,61 52.25,61 53.25,62 46.75,62" fill={`url(#gold-grad-col2-${uid})`} />
          </Svg>
        </Animated.View>

        {/* Layer 5: Column 3 (Right Pillar) */}
        <Animated.View style={[StyleSheet.absoluteFill, col3AnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`gold-col-3-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#AA7C11" />
                <Stop offset="30%" stopColor="#FCE79A" />
                <Stop offset="70%" stopColor="#D4AF37" />
                <Stop offset="100%" stopColor="#755811" />
              </LinearGradient>
              <LinearGradient id={`gold-grad-col3-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#FFECA8" />
                <Stop offset="100%" stopColor="#8A6308" />
              </LinearGradient>
            </Defs>
            <Rect x={60.5} y={49.5} width={4.5} height={11.5} fill={`url(#gold-col-3-${uid})`} />
            <Polygon points="59.5,48.5 66,48.5 65,49.5 60.5,49.5" fill={`url(#gold-grad-col3-${uid})`} />
            <Polygon points="60.5,61 65,61 66,62 59.5,62" fill={`url(#gold-grad-col3-${uid})`} />
          </Svg>
        </Animated.View>

        {/* Layer 6: Roof Pediment */}
        <Animated.View style={[StyleSheet.absoluteFill, roofAnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`gold-grad-roof-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#FFECA8" />
                <Stop offset="25%" stopColor="#D4AF37" />
                <Stop offset="50%" stopColor="#AA7C11" />
                <Stop offset="75%" stopColor="#D4AF37" />
                <Stop offset="100%" stopColor="#8A6308" />
              </LinearGradient>
              <LinearGradient id={`gold-dark-roof-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#B38B22" />
                <Stop offset="100%" stopColor="#755811" />
              </LinearGradient>
            </Defs>
            <Polygon points="50,26 72,44 28,44" fill={`url(#gold-grad-roof-${uid})`} />
            <Polygon points="50,30 65,42 35,42" fill={`url(#gold-dark-roof-${uid})`} />
            <Circle cx={50} cy={38} r={2.5} fill={`url(#gold-grad-roof-${uid})`} />
            <Rect x={28} y={44} width={44} height={3} rx={0.5} fill={`url(#gold-grad-roof-${uid})`} />
            <Rect x={31} y={47} width={38} height={1.5} fill={`url(#gold-dark-roof-${uid})`} />
          </Svg>
        </Animated.View>

        {/* Layer 7: Marble Dust Burst Effects */}
        <Animated.View style={[StyleSheet.absoluteFill, dustBaseAnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Ellipse cx="29" cy="67" rx="5" ry="2" fill="#FFFFFF" opacity={0.85} />
            <Ellipse cx="71" cy="67" rx="5" ry="2" fill="#FFFFFF" opacity={0.85} />
            <Ellipse cx="50" cy="67" rx="7" ry="2" fill="#FFFFFF" opacity={0.65} />
          </Svg>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, dustColAnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Ellipse cx="37" cy="62" rx="4" ry="1.5" fill="#FFFFFF" opacity={0.85} />
            <Ellipse cx="50" cy="62" rx="4" ry="1.5" fill="#FFFFFF" opacity={0.85} />
            <Ellipse cx="63" cy="62" rx="4" ry="1.5" fill="#FFFFFF" opacity={0.85} />
          </Svg>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, dustRoofAnimatedStyle]}>
          <Svg width={heroPx} height={heroPx} viewBox="0 0 100 100">
            <Ellipse cx="28" cy="44" rx="5" ry="2" fill="#FFFFFF" opacity={0.85} />
            <Ellipse cx="72" cy="44" rx="5" ry="2" fill="#FFFFFF" opacity={0.85} />
            <Ellipse cx="50" cy="44" rx="6" ry="2.5" fill="#FFFFFF" opacity={0.65} />
          </Svg>
        </Animated.View>

        {/* Layer 8: Finishing Sweeping Gold Glint */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shineContainer,
            { width: heroPx * 1.5, height: heroPx * 1.5 },
            shineAnimatedStyle,
          ]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`glint-grad-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.9} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="40" y="0" width="20" height="100" fill={`url(#glint-grad-${uid})`} />
            <Rect x="48" y="0" width="4" height="100" fill="#FFFFFF" opacity={0.95} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  anchorWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  masterHeroCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
    borderRadius: 9999,
    backgroundColor: '#FAF7F0',
  },
  shineContainer: {
    position: 'absolute',
    top: '-25%',
    left: '-25%',
    overflow: 'hidden',
    borderRadius: 9999,
  },
});

export default VerifiedBadge;