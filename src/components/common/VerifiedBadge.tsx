import React, { useEffect, memo } from 'react';
import { Pressable } from 'react-native';
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
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DURATION = 2800;

const SIZE_MAP: Record<string, number> = {
  sm: 16,
  md: 24,
  lg: 44,
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
  size = 24,
  animate = true,
  variant,
  text,
  style,
}: {
  size?: number | string;
  animate?: boolean;
  variant?: string;
  text?: string;
  style?: any;
}) {
  const progress = useSharedValue(0);
  const isPlayingRef = React.useRef(false);
  const finalSize = typeof size === 'string' ? SIZE_MAP[size] || 24 : size;

  const play = () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    progress.value = 0;
    progress.value = withTiming(1.3, {
      duration: DURATION * 1.3,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) {
        isPlayingRef.current = false;
      }
    });
  };

  useEffect(() => {
    if (animate) {
      play();
    } else {
      progress.value = 1.3;
    }
  }, [animate, finalSize]);

  // Animated properties matching web implementation

  // 1. Main View scale (up to 3.6x hero scale, then shrinks back to 1x)
  const mainScaleStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const HERO_SCALE = 3.6;
    let currentScale = 1;

    if (t < 0.15) {
      currentScale = Math.max(0.001, easeOutBack(sub(t, 0, 0.15)) * HERO_SCALE);
    } else if (t < 0.80) {
      currentScale = HERO_SCALE;
    } else if (t < 1.05) {
      const shrinkProg = sub(t, 0.80, 1.05);
      currentScale = HERO_SCALE - (HERO_SCALE - 1) * easeInOutCubic(shrinkProg);
    } else {
      currentScale = 1;
    }

    return {
      transform: [
        { scale: currentScale },
      ],
    };
  });

  // 2. Inner Ring & Solid Fill Opacities
  const irProps = useAnimatedProps(() => {
    const t = progress.value;
    return {
      opacity: easeOutCubic(sub(t, 0.05, 0.20)),
    };
  });

  const sfProps = useAnimatedProps(() => {
    const t = progress.value;
    return {
      opacity: easeOutCubic(sub(t, 0.08, 0.22)),
    };
  });

  // 3. Foundation Base
  const baseProps = useAnimatedProps(() => {
    const t = progress.value;
    const buildBase = easeOutExpo(sub(t, 0.15, 0.35));
    return {
      transform: [
        { translateX: 50 },
        { translateY: 67.5 },
        { scaleY: Math.max(0.001, buildBase) },
        { translateX: -50 },
        { translateY: -67.5 },
      ],
    };
  });

  const dustBaseProps = useAnimatedProps(() => {
    const t = progress.value;
    const baseHit = sub(t, 0.32, 0.42);
    const opacity = baseHit > 0 && baseHit < 1 ? 1 - baseHit : 0;
    const scale = baseHit > 0 && baseHit < 1 ? easeOutExpo(baseHit) * 1.5 : 0.001;
    return {
      opacity,
      transform: [
        { translateX: 50 },
        { translateY: 67 },
        { scale },
        { translateX: -50 },
        { translateY: -67 },
      ],
    };
  });

  // 4. Columns
  const col1Props = useAnimatedProps(() => {
    const t = progress.value;
    const buildCol1 = easeOutExpo(sub(t, 0.25, 0.45));
    return {
      transform: [
        { translateX: 37.25 },
        { translateY: 62 },
        { scaleY: Math.max(0.001, buildCol1) },
        { translateX: -37.25 },
        { translateY: -62 },
      ],
    };
  });

  const col2Props = useAnimatedProps(() => {
    const t = progress.value;
    const buildCol2 = easeOutExpo(sub(t, 0.30, 0.50));
    return {
      transform: [
        { translateX: 50 },
        { translateY: 62 },
        { scaleY: Math.max(0.001, buildCol2) },
        { translateX: -50 },
        { translateY: -62 },
      ],
    };
  });

  const col3Props = useAnimatedProps(() => {
    const t = progress.value;
    const buildCol3 = easeOutExpo(sub(t, 0.35, 0.55));
    return {
      transform: [
        { translateX: 62.75 },
        { translateY: 62 },
        { scaleY: Math.max(0.001, buildCol3) },
        { translateX: -62.75 },
        { translateY: -62 },
      ],
    };
  });

  const dustColProps = useAnimatedProps(() => {
    const t = progress.value;
    const colHit = sub(t, 0.52, 0.62);
    const opacity = colHit > 0 && colHit < 1 ? 1 - colHit : 0;
    const scale = colHit > 0 && colHit < 1 ? easeOutExpo(colHit) * 1.5 : 0.001;
    return {
      opacity,
      transform: [
        { translateX: 50 },
        { translateY: 62 },
        { scale },
        { translateX: -50 },
        { translateY: -62 },
      ],
    };
  });

  // 5. Roof
  const roofProps = useAnimatedProps(() => {
    const t = progress.value;
    const buildRoof = easeOutBack(sub(t, 0.45, 0.70));
    return {
      transform: [
        { translateX: 50 },
        { translateY: 48.5 },
        { scale: Math.max(0.001, buildRoof) },
        { translateX: -50 },
        { translateY: -48.5 },
      ],
    };
  });

  const dustRoofProps = useAnimatedProps(() => {
    const t = progress.value;
    const roofHit = sub(t, 0.65, 0.75);
    const opacity = roofHit > 0 && roofHit < 1 ? 1 - roofHit : 0;
    const scale = roofHit > 0 && roofHit < 1 ? easeOutExpo(roofHit) * 1.5 : 0.001;
    return {
      opacity,
      transform: [
        { translateX: 50 },
        { translateY: 44 },
        { scale },
        { translateX: -50 },
        { translateY: -44 },
      ],
    };
  });

  // 6. Text Arc Fade & Scale
  const textProps = useAnimatedProps(() => {
    const t = progress.value;
    const textProg = sub(t, 0.65, 0.85);
    return {
      opacity: easeOutCubic(textProg),
      transform: [
        { translateX: 50 },
        { translateY: 50 },
        { scale: 1.15 - easeOutCubic(textProg) * 0.15 },
        { translateX: -50 },
        { translateY: -50 },
      ],
    };
  });

  // 7. Gold Shine Sweeping Glint
  const shineProps = useAnimatedProps(() => {
    const t = progress.value;
    const shineProg = sub(t, 1.05, 1.25);
    const opacity = shineProg > 0 && shineProg < 1 ? 1 : 0;
    const translateX = -140 + shineProg * 280;
    return {
      opacity,
      transform: [
        { translateX },
      ],
    };
  });

  const strokeW = finalSize <= 20 ? 4 : finalSize <= 28 ? 3.5 : finalSize <= 44 ? 3 : 2.5;
  const showInner = true;
  const showDetails = true;

  return (
    <Pressable
      onPress={play}
      style={[
        {
          width: finalSize,
          height: finalSize,
          position: 'relative',
          zIndex: 50,
          overflow: 'visible',
        },
        style,
      ]}
    >
      <Animated.View style={[{ width: finalSize, height: finalSize, overflow: 'visible' }, mainScaleStyle]}>
        <Svg
          width={finalSize}
          height={finalSize}
          viewBox='0 0 100 100'
          style={{ overflow: 'visible' }}
        >
          <Defs>
            <RadialGradient id="badge-bg" cx="50%" cy="50%" r="50%">
              <Stop offset='0%' stopColor='#FFFFFF' />
              <Stop offset='60%' stopColor='#F9F6F0' />
              <Stop offset='100%' stopColor='#EAE5D9' />
            </RadialGradient>
            <LinearGradient id="gold-grad" x1='0' y1='0' x2='1' y2='1'>
              <Stop offset='0%' stopColor='#FFECA8' />
              <Stop offset='25%' stopColor='#D4AF37' />
              <Stop offset='50%' stopColor='#AA7C11' />
              <Stop offset='75%' stopColor='#D4AF37' />
              <Stop offset='100%' stopColor='#8A6308' />
            </LinearGradient>
            <LinearGradient id="gold-dark" x1='0' y1='0' x2='0' y2='1'>
              <Stop offset='0%' stopColor='#B38B22' />
              <Stop offset='100%' stopColor='#755811' />
            </LinearGradient>
            <LinearGradient id="gold-col" x1='0' y1='0' x2='1' y2='0'>
              <Stop offset='0%' stopColor='#AA7C11' />
              <Stop offset='30%' stopColor='#FCE79A' />
              <Stop offset='70%' stopColor='#D4AF37' />
              <Stop offset='100%' stopColor='#755811' />
            </LinearGradient>
            <LinearGradient id="shine-grad" x1='0' y1='0' x2='1' y2='0'>
              <Stop offset='0%' stopColor='#FFFFFF' stopOpacity={0} />
              <Stop offset='50%' stopColor='#FFFFFF' stopOpacity={0.8} />
              <Stop offset='100%' stopColor='#FFFFFF' stopOpacity={0} />
            </LinearGradient>
            <ClipPath id="badge-clip">
              <Circle cx='50' cy='50' r='46.5' />
            </ClipPath>
            <Path id="text-arc" d='M 6,50 A 44,44 0 0,0 94,50' />
          </Defs>

          <G>
            <Circle cx='50' cy='50' r={49} fill="url(#badge-bg)" />
            <Circle cx='50' cy='50' r={46.5} fill='none' stroke="url(#gold-grad)" strokeWidth={strokeW} />
            {showInner && <Circle cx='50' cy='50' r={44} fill='none' stroke="url(#gold-grad)" strokeWidth={0.5} opacity={0.6} />}
            
            <G>
              {[...Array(48)].map((_, i) => {
                const a = (i / 48) * Math.PI * 2;
                const x1 = (50 + 42.5 * Math.cos(a)).toFixed(2);
                const y1 = (50 + 42.5 * Math.sin(a)).toFixed(2);
                const x2 = (50 + 44.5 * Math.cos(a)).toFixed(2);
                const y2 = (50 + 44.5 * Math.sin(a)).toFixed(2);
                return (
                  <Line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="url(#gold-grad)"
                    strokeWidth={finalSize < 40 ? 1 : 0.75}
                  />
                );
              })}
            </G>

            <AnimatedCircle cx='50' cy='50' r={35} fill='none' stroke="url(#gold-dark)" strokeWidth={0.75} animatedProps={irProps} />
            <AnimatedCircle cx='50' cy='50' r={34.5} fill="url(#badge-bg)" animatedProps={sfProps} />
            
            {showDetails && (
              <AnimatedG animatedProps={textProps}>
                <SvgText
                  fontSize={6.4}
                  fontWeight='bold'
                  fill='#4A3100'
                  letterSpacing={1.5}
                  fontFamily="Georgia"
                  textAnchor='middle'
                >
                  <TextPath href="#text-arc" startOffset='50%'>✦ RATEDEED · VERIFIED ✦</TextPath>
                </SvgText>
              </AnimatedG>
            )}

            <AnimatedG animatedProps={baseProps}>
              <Rect x={32} y={62} width={36} height={2.5} rx={0.5} fill="url(#gold-grad)" />
              <Rect x={29} y={64.5} width={42} height={3} rx={0.5} fill="url(#gold-dark)" />
            </AnimatedG>

            <AnimatedG animatedProps={col1Props}>
              <Rect x={35} y={49.5} width={4.5} height={11.5} fill="url(#gold-col)" />
              <Polygon points='34,48.5 40.5,48.5 39.5,49.5 35,49.5' fill="url(#gold-grad)" />
              <Polygon points='35,61 39.5,61 40.5,62 34,62' fill="url(#gold-grad)" />
            </AnimatedG>
            <AnimatedG animatedProps={col2Props}>
              <Rect x={47.75} y={49.5} width={4.5} height={11.5} fill="url(#gold-col)" />
              <Polygon points='46.75,48.5 53.25,48.5 52.25,49.5 47.75,49.5' fill="url(#gold-grad)" />
              <Polygon points='47.75,61 52.25,61 53.25,62 46.75,62' fill="url(#gold-grad)" />
            </AnimatedG>
            <AnimatedG animatedProps={col3Props}>
              <Rect x={60.5} y={49.5} width={4.5} height={11.5} fill="url(#gold-col)" />
              <Polygon points='59.5,48.5 66,48.5 65,49.5 60.5,49.5' fill="url(#gold-grad)" />
              <Polygon points='60.5,61 65,61 66,62 59.5,62' fill="url(#gold-grad)" />
            </AnimatedG>

            <AnimatedG animatedProps={roofProps}>
              <Polygon points='50,26 72,44 28,44' fill="url(#gold-grad)" />
              <Polygon points='50,30 65,42 35,42' fill="url(#gold-dark)" />
              <Circle cx={50} cy={38} r={2.5} fill="url(#gold-grad)" />
              <Rect x={28} y={44} width={44} height={3} rx={0.5} fill="url(#gold-grad)" />
              <Rect x={31} y={47} width={38} height={1.5} fill="url(#gold-dark)" />
            </AnimatedG>

            {/* Marble Dust & Sweeping Glint */}
            <AnimatedG animatedProps={dustBaseProps}>
              <Ellipse cx="29" cy="67" rx="5" ry="2" fill="#FFF" opacity={0.8} />
              <Ellipse cx="71" cy="67" rx="5" ry="2" fill="#FFF" opacity={0.8} />
              <Ellipse cx="50" cy="67" rx="7" ry="2" fill="#FFF" opacity={0.6} />
            </AnimatedG>
            <AnimatedG animatedProps={dustColProps}>
              <Ellipse cx="37" cy="62" rx="4" ry="1.5" fill="#FFF" opacity={0.8} />
              <Ellipse cx="50" cy="62" rx="4" ry="1.5" fill="#FFF" opacity="0.8" />
              <Ellipse cx="63" cy="62" rx="4" ry="1.5" fill="#FFF" opacity={0.8} />
            </AnimatedG>
            <AnimatedG animatedProps={dustRoofProps}>
              <Ellipse cx="28" cy="44" rx="5" ry="2" fill="#FFF" opacity={0.8} />
              <Ellipse cx="72" cy="44" rx="5" ry="2" fill="#FFF" opacity={0.8} />
              <Ellipse cx="50" cy="44" rx="6" ry="2.5" fill="#FFF" opacity={0.6} />
            </AnimatedG>

            <G clipPath="url(#badge-clip)">
              <AnimatedG animatedProps={shineProps}>
                <Rect x='-20' y='-50' width='15' height='200' fill="url(#shine-grad)" transform='rotate(35, 50, 50)' />
                <Rect x='0' y='-50' width='3' height='200' fill='#FFFFFF' opacity={0.9} transform='rotate(35, 50, 50)' />
              </AnimatedG>
            </G>
          </G>
        </Svg>
      </Animated.View>
    </Pressable>
  );
});

export default VerifiedBadge;