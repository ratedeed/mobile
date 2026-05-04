import React, { useEffect, useId, memo } from 'react';
import { View } from 'react-native';
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
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

const DURATION = 2800;

const SIZE_MAP = {
  sm: 20,
  md: 28,
  lg: 44,
};

export const VerifiedBadge = memo(({ 
  size = 28, 
  animate = true,
  // Compatibility props
  variant,
  text,
  style,
}: { 
  size?: number | 'sm' | 'md' | 'lg'; 
  animate?: boolean;
  variant?: string;
  text?: string;
  style?: any;
}) => {
  const uid = useId().replace(/:/g, '-');
  const progress = useSharedValue(0);

  const finalSize = typeof size === 'string' ? SIZE_MAP[size] || 28 : size;

  useEffect(() => {
    if (animate) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: DURATION,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
    } else {
      progress.value = 1;
    }
  }, [animate]);

  const animatedSvgStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      progress.value,
      [0, 0.15, 0.8, 1],
      [0, 4.5, 4.5, 1]
    );
    const zIndex = progress.value < 0.95 ? 50 : 1;
    return {
      transform: [{ scale }],
      zIndex,
    };
  });

  const baseProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 50 },
      { translateY: 67.5 },
      { scaleY: interpolate(progress.value, [0.15, 0.35], [0, 1], 'clamp') },
      { translateX: -50 },
      { translateY: -67.5 },
    ],
  }));

  const col1Props = useAnimatedProps(() => ({
    transform: [
      { translateX: 37.25 },
      { translateY: 62 },
      { scaleY: interpolate(progress.value, [0.25, 0.45], [0, 1], 'clamp') },
      { translateX: -37.25 },
      { translateY: -62 },
    ],
  }));

  const col2Props = useAnimatedProps(() => ({
    transform: [
      { translateX: 50 },
      { translateY: 62 },
      { scaleY: interpolate(progress.value, [0.3, 0.5], [0, 1], 'clamp') },
      { translateX: -50 },
      { translateY: -62 },
    ],
  }));

  const col3Props = useAnimatedProps(() => ({
    transform: [
      { translateX: 62.75 },
      { translateY: 62 },
      { scaleY: interpolate(progress.value, [0.35, 0.55], [0, 1], 'clamp') },
      { translateX: -62.75 },
      { translateY: -62 },
    ],
  }));

  const roofProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 50 },
      { translateY: 48.5 },
      { scale: interpolate(progress.value, [0.45, 0.7], [0, 1], 'clamp') },
      { translateX: -50 },
      { translateY: -48.5 },
    ],
  }));

  const textProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0.65, 0.85], [0, 1], 'clamp'),
    transform: [
      { translateX: 50 },
      { translateY: 50 },
      { scale: interpolate(progress.value, [0.65, 0.85], [1.15, 1], 'clamp') },
      { translateX: -50 },
      { translateY: -50 },
    ],
  }));

  const shineProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [1, 1.05, 1.2, 1.25], [0, 1, 1, 0], 'clamp'),
    transform: [
      { translateX: -140 + interpolate(progress.value, [1.05, 1.25], [0, 280], 'clamp') },
    ],
  }));

  return (
    <View style={[{ width: finalSize, height: finalSize }, style]}>
      <AnimatedSvg
        width={finalSize}
        height={finalSize}
        viewBox='0 0 100 100'
        style={[animatedSvgStyle, { overflow: 'visible' }]}
      >
        <Defs>
          <RadialGradient id={'badge-bg-' + uid} cx='50%' cy='50%' r='50%' gradientUnits='userSpaceOnUse'>
            <Stop offset='0%' stopColor='#FFFFFF' />
            <Stop offset='60%' stopColor='#F9F6F0' />
            <Stop offset='100%' stopColor='#EAE5D9' />
          </RadialGradient>
          <LinearGradient id={'gold-grad-' + uid} x1='0' y1='0' x2='1' y2='1'>
            <Stop offset='0%' stopColor='#FFECA8' />
            <Stop offset='25%' stopColor='#D4AF37' />
            <Stop offset='50%' stopColor='#AA7C11' />
            <Stop offset='75%' stopColor='#D4AF37' />
            <Stop offset='100%' stopColor='#8A6308' />
          </LinearGradient>
          <LinearGradient id={'gold-dark-' + uid} x1='0' y1='0' x2='0' y2='1'>
            <Stop offset='0%' stopColor='#B38B22' />
            <Stop offset='100%' stopColor='#755811' />
          </LinearGradient>
          <LinearGradient id={'gold-col-' + uid} x1='0' y1='0' x2='1' y2='0'>
            <Stop offset='0%' stopColor='#AA7C11' />
            <Stop offset='30%' stopColor='#FCE79A' />
            <Stop offset='70%' stopColor='#D4AF37' />
            <Stop offset='100%' stopColor='#755811' />
          </LinearGradient>
          <LinearGradient id={'shine-grad-' + uid} x1='0' y1='0' x2='1' y2='0'>
            <Stop offset='0%' stopColor='#FFFFFF' stopOpacity='0' />
            <Stop offset='50%' stopColor='#FFFFFF' stopOpacity='0.8' />
            <Stop offset='100%' stopColor='#FFFFFF' stopOpacity='0' />
          </LinearGradient>
          <ClipPath id={'badge-clip-' + uid}>
            <Circle cx='50' cy='50' r='46.5' />
          </ClipPath>
          <Path id={'text-arc-' + uid} d='M 6,50 A 44,44 0 0,0 94,50' />
        </Defs>

        <G>
          <Circle cx='50' cy='50' r={49} fill={'url(#badge-bg-' + uid + ')'} />
          <Circle cx='50' cy='50' r={46.5} fill='none' stroke={'url(#gold-grad-' + uid + ')'} strokeWidth={2.5} />
          
          <G>
            {[...Array(48)].map((_, i) => {
              const a = (i / 48) * Math.PI * 2;
              return (
                <Rect
                  key={i}
                  x={50 + 42.5 * Math.cos(a)}
                  y={50 + 42.5 * Math.sin(a)}
                  width={2}
                  height={0.75}
                  fill={'url(#gold-grad-' + uid + ')'}
                  transform={'rotate(' + ((i / 48) * 360) + ', 50, 50)'}
                />
              );
            })}
          </G>

          <Circle cx='50' cy='50' r={35} fill='none' stroke={'url(#gold-dark-' + uid + ')'} strokeWidth={0.75} />
          
          <AnimatedG animatedProps={textProps}>
            <SvgText
              fontSize={6.4}
              fontWeight='bold'
              fill='#4A3100'
              fontFamily='Georgia'
              textAnchor='middle'
            >
              <TextPath href={'#text-arc-' + uid} startOffset='50%'>✦ RATEDEED · VERIFIED ✦</TextPath>
            </SvgText>
          </AnimatedG>

          <AnimatedG animatedProps={baseProps}>
            <Rect x={32} y={62} width={36} height={2.5} rx={0.5} fill={'url(#gold-grad-' + uid + ')'} />
            <Rect x={29} y={64.5} width={42} height={3} rx={0.5} fill={'url(#gold-dark-' + uid + ')'} />
          </AnimatedG>

          <AnimatedG animatedProps={col1Props}>
            <Rect x={35} y={49.5} width={4.5} height={11.5} fill={'url(#gold-col-' + uid + ')'} />
            <Polygon points='34,48.5 40.5,48.5 39.5,49.5 35,49.5' fill={'url(#gold-grad-' + uid + ')'} />
            <Polygon points='35,61 39.5,61 40.5,62 34,62' fill={'url(#gold-grad-' + uid + ')'} />
          </AnimatedG>
          <AnimatedG animatedProps={col2Props}>
            <Rect x={47.75} y={49.5} width={4.5} height={11.5} fill={'url(#gold-col-' + uid + ')'} />
            <Polygon points='46.75,48.5 53.25,48.5 52.25,49.5 47.75,49.5' fill={'url(#gold-grad-' + uid + ')'} />
            <Polygon points='47.75,61 52.25,61 53.25,62 46.75,62' fill={'url(#gold-grad-' + uid + ')'} />
          </AnimatedG>
          <AnimatedG animatedProps={col3Props}>
            <Rect x={60.5} y={49.5} width={4.5} height={11.5} fill={'url(#gold-col-' + uid + ')'} />
            <Polygon points='59.5,48.5 66,48.5 65,49.5 60.5,49.5' fill={'url(#gold-grad-' + uid + ')'} />
            <Polygon points='60.5,61 65,61 66,62 59.5,62' fill={'url(#gold-grad-' + uid + ')'} />
          </AnimatedG>

          <AnimatedG animatedProps={roofProps}>
            <Polygon points='50,26 72,44 28,44' fill={'url(#gold-grad-' + uid + ')'} />
            <Polygon points='50,30 65,42 35,42' fill={'url(#gold-dark-' + uid + ')'} />
            <Circle cx={50} cy={38} r={2.5} fill={'url(#gold-grad-' + uid + ')'} />
            <Rect x={28} y={44} width={44} height={3} rx={0.5} fill={'url(#gold-grad-' + uid + ')'} />
            <Rect x={31} y={47} width={38} height={1.5} fill={'url(#gold-dark-' + uid + ')'} />
          </AnimatedG>

          <G clipPath={'url(#badge-clip-' + uid + ')'}>
            <AnimatedG animatedProps={shineProps}>
              <Rect x='-20' y='-50' width='15' height='200' fill={'url(#shine-grad-' + uid + ')'} transform='rotate(35, 50, 50)' />
              <Rect x='0' y='-50' width='3' height='200' fill='#FFFFFF' opacity={0.9} transform='rotate(35, 50, 50)' />
            </AnimatedG>
          </G>
        </G>
      </AnimatedSvg>
    </View>
  );
});

export default VerifiedBadge;
