import React, { useEffect, memo, useRef } from 'react';
import { View, Pressable, Text, Platform } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Ellipse,
  G,
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  SharedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

// ═══════════════════════════════════════════════════════════════════════
// ANIMATED PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// ═══════════════════════════════════════════════════════════════════════
// WORKLETS & HELPERS
// ═══════════════════════════════════════════════════════════════════════

const easeOutExpo = (t: number) => {
  'worklet';
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

const easeOutBack = (t: number, c = 1.70158) => {
  'worklet';
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const easeOutCubic = (t: number) => {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
};

const easeInOutSine = (t: number) => {
  'worklet';
  return -(Math.cos(Math.PI * t) - 1) / 2;
};

const easeOutElastic = (t: number) => {
  'worklet';
  const c = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};

const easeInQuad = (t: number) => {
  'worklet';
  return t * t;
};

const easeOutQuad = (t: number) => {
  'worklet';
  return 1 - (1 - t) * (1 - t);
};

/** Normalised sub-range progress. Clamps to [0,1]. */
const sub = (t: number, s: number, e: number) => {
  'worklet';
  return Math.max(0, Math.min(1, (t - s) / (e - s)));
};

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.max(min, Math.min(max, v));
};

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION  –  Colour, shadow, tilt & float per category
// ═══════════════════════════════════════════════════════════════════════

export const catGradients: Record<
  string,
  { from: string; to: string; mid: string; bg: string; glow: string }
> = {
  grid: {
    from: '#71717a',
    to: '#3f3f46',
    mid: '#a1a1aa',
    bg: 'bg-neutral-100 dark:bg-neutral-900',
    glow: 'rgba(113,113,122,0.5)',
  },
  home: {
    from: '#f59e0b',
    to: '#b45309',
    mid: '#fbbf24',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    glow: 'rgba(245,158,11,0.55)',
  },
  droplets: {
    from: '#0ea5e9',
    to: '#0369a1',
    mid: '#38bdf8',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    glow: 'rgba(14,165,233,0.55)',
  },
  zap: {
    from: '#eab308',
    to: '#ca8a04',
    mid: '#fde047',
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    glow: 'rgba(234,179,8,0.6)',
  },
  paintbrush: {
    from: '#8b5cf6',
    to: '#6d28d9',
    mid: '#a78bfa',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    glow: 'rgba(139,92,246,0.55)',
  },
  trees: {
    from: '#10b981',
    to: '#047857',
    mid: '#34d399',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    glow: 'rgba(16,185,129,0.55)',
  },
  wind: {
    from: '#06b6d4',
    to: '#0e7490',
    mid: '#22d3ee',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    glow: 'rgba(6,182,212,0.55)',
  },
  warehouse: {
    from: '#f97316',
    to: '#c2410c',
    mid: '#fb923c',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    glow: 'rgba(249,115,22,0.55)',
  },
  sparkles: {
    from: '#ec4899',
    to: '#be185d',
    mid: '#f472b6',
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    glow: 'rgba(236,72,153,0.55)',
  },
  wrench: {
    from: '#64748b',
    to: '#334155',
    mid: '#94a3b8',
    bg: 'bg-slate-50 dark:bg-slate-950/40',
    glow: 'rgba(100,116,139,0.5)',
  },
  hammer: {
    from: '#92400e',
    to: '#451a03',
    mid: '#b45309',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    glow: 'rgba(146,64,14,0.55)',
  },
};

export const catActiveBg: Record<string, string> = {
  grid: 'bg-neutral-800 dark:bg-neutral-200',
  home: 'bg-amber-600',
  droplets: 'bg-sky-600',
  zap: 'bg-yellow-500',
  paintbrush: 'bg-violet-600',
  trees: 'bg-emerald-600',
  wind: 'bg-cyan-600',
  warehouse: 'bg-orange-600',
  sparkles: 'bg-pink-600',
  wrench: 'bg-slate-700',
  hammer: 'bg-amber-800',
};

type Icon3D = {
  floatAmpY: number;
  floatAmpX: number;
  floatRot: number;
  floatSpeed: number;
  phaseOffset: number;
};

const icon3D: Record<string, Icon3D> = {
  home: { floatAmpY: 4.5, floatAmpX: 1.8, floatRot: 1.8, floatSpeed: 4500, phaseOffset: 0 },
  droplets: { floatAmpY: 5.5, floatAmpX: 2.2, floatRot: 2.2, floatSpeed: 3800, phaseOffset: 0.3 },
  hammer: { floatAmpY: 3.5, floatAmpX: 1.2, floatRot: 1.2, floatSpeed: 5000, phaseOffset: 0.6 },
  zap: { floatAmpY: 5.5, floatAmpX: 2.2, floatRot: 2.5, floatSpeed: 3200, phaseOffset: 0.9 },
  trees: { floatAmpY: 3.5, floatAmpX: 1.2, floatRot: 1.2, floatSpeed: 5200, phaseOffset: 1.2 },
  wind: { floatAmpY: 3.5, floatAmpX: 2.2, floatRot: 2.2, floatSpeed: 3600, phaseOffset: 1.5 },
  sparkles: { floatAmpY: 5.5, floatAmpX: 2.2, floatRot: 2.2, floatSpeed: 3800, phaseOffset: 1.8 },
  wrench: { floatAmpY: 3.5, floatAmpX: 1.2, floatRot: 1.5, floatSpeed: 4800, phaseOffset: 2.1 },
  warehouse: { floatAmpY: 3, floatAmpX: 1.2, floatRot: 1, floatSpeed: 5500, phaseOffset: 2.4 },
  paintbrush: { floatAmpY: 4.5, floatAmpX: 1.8, floatRot: 2, floatSpeed: 4200, phaseOffset: 2.7 },
  grid: { floatAmpY: 3.5, floatAmpX: 1.2, floatRot: 1.2, floatSpeed: 5000, phaseOffset: 3.0 },
};

// ═══════════════════════════════════════════════════════════════════════
// SHARED GRADIENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

function GradientDef({
  name,
  g,
}: {
  name: string;
  g?: { from: string; to: string; mid: string };
}) {
  if (!g) return null;
  return (
    <Defs>
      <LinearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={g.from} />
        <Stop offset="45%" stopColor={g.mid} />
        <Stop offset="100%" stopColor={g.to} />
      </LinearGradient>
      <RadialGradient id={`shine-${name}`} cx="35%" cy="25%" r="55%">
        <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </RadialGradient>
    </Defs>
  );
}

type IconProps = {
  active: boolean;
  selectProgress: SharedValue<number>;
  name: string;
  g?: { from: string; to: string; mid: string };
};

const SVG_PROPS = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' as const };

// ═══════════════════════════════════════════════════════════════════════
// HOME ICON — roof lifts, body pops, windows light up, smoke puffs
// ═══════════════════════════════════════════════════════════════════════

function HomeIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Roof: lift up and tilt slightly on select
  const roofProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const lift = s > 0 ? -4 * Math.sin(s * Math.PI) : 0;
    const rot = s > 0 ? 3 * Math.sin(s * Math.PI) : 0;
    return {
      transform: [
        { translateX: 12 },
        { translateY: 8 },
        { translateY: lift },
        { rotate: `${rot}deg` },
        { translateX: -12 },
        { translateY: -8 },
      ],
    };
  });

  // Body: pop-in scale
  const bodyProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.1, 0.7);
    const scale = s > 0 ? 1 + 0.12 * easeOutBack(p) * Math.sin(s * Math.PI) : 1;
    return {
      transform: [
        { translateX: 12 },
        { translateY: 16 },
        { scale },
        { translateX: -12 },
        { translateY: -16 },
      ],
    };
  });

  // Door: opens (scaleX)
  const doorProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.25, 0.85);
    const scaleX = s > 0 ? 1 - 0.35 * easeOutCubic(p) : 1;
    const opacity = s > 0 ? 1 - 0.4 * p : 1;
    return {
      opacity,
      transform: [
        { translateX: 12 },
        { translateY: 16 },
        { scaleX },
        { translateX: -12 },
        { translateY: -16 },
      ],
    };
  });

  // Windows light up sequentially
  const win1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.3, 0.7);
    const opacity = s > 0 ? 0.4 + 0.6 * easeOutCubic(p) : 0.7;
    return { opacity };
  });

  const win2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.45, 0.85);
    const opacity = s > 0 ? 0.4 + 0.6 * easeOutCubic(p) : 0.7;
    return { opacity };
  });

  // Smoke puffs from chimney
  const smokeProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 1);
    const opacity = p > 0 ? (1 - p) * 0.5 : 0;
    const translateY = -p * 6;
    const scale = 0.5 + p * 0.8;
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      {/* Glow background */}
      <Circle cx="12" cy="12" r="11" fill={active ? '#ffffff20' : g?.mid || '#fbbf24'} opacity={0.12} />
      {/* Smoke */}
      {!active && (
        <AnimatedG animatedProps={smokeProps}>
          <Circle cx="17" cy="4" r="1" fill={g?.mid || '#fbbf24'} />
          <Circle cx="18.5" cy="2.5" r="0.7" fill={g?.mid || '#fbbf24'} />
        </AnimatedG>
      )}
      {/* Body shadow */}
      <AnimatedG animatedProps={bodyProps}>
        <Path d="M3 21V10h18v11H3z" fill={fill} opacity={0.35} />
        <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={fill} />
        {!active && <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      {/* Roof (separate layer for lift) */}
      <AnimatedG animatedProps={roofProps}>
        <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill="none" stroke={fill} strokeWidth="0.5" opacity={0.3} />
      </AnimatedG>
      {/* Door */}
      <AnimatedRect
        x="10.5"
        y="14"
        width="3"
        height="5"
        rx="0.8"
        fill={active ? '#ffffff88' : '#fcd34d'}
        animatedProps={doorProps}
      />
      {/* Windows */}
      <AnimatedRect
        x="4.5"
        y="14.5"
        width="3"
        height="3"
        rx="0.5"
        fill={active ? '#ffffff' : '#fde68a'}
        animatedProps={win1Props}
      />
      <AnimatedRect
        x="16.5"
        y="14.5"
        width="3"
        height="3"
        rx="0.5"
        fill={active ? '#ffffff' : '#fde68a'}
        animatedProps={win2Props}
      />
      {/* Chimney */}
      <Rect x="16" y="5" width="2" height="3" rx="0.3" fill={fill} opacity={0.8} />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DROPLETS ICON — main squeeze, satellites orbit, shimmer
// ═══════════════════════════════════════════════════════════════════════

function DropletsIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const mainProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = s > 0 ? Math.sin(s * Math.PI) : 0;
    const scaleY = 1 - 0.3 * pulse;
    const scaleX = 1 + 0.2 * pulse;
    return {
      transform: [
        { translateX: 12 },
        { translateY: 15 },
        { scaleX },
        { scaleY },
        { translateX: -12 },
        { translateY: -15 },
      ],
    };
  });

  const sat1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const angle = s * Math.PI * 2;
    const r = 4 + s * 3;
    const tx = Math.cos(angle - Math.PI / 2) * r;
    const ty = Math.sin(angle - Math.PI / 2) * r;
    const scale = 0.7 + 0.6 * Math.sin(s * Math.PI);
    return {
      opacity: s > 0 ? Math.sin(s * Math.PI) : 0.6,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  const sat2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const angle = s * Math.PI * 2 + Math.PI;
    const r = 5 + s * 2;
    const tx = Math.cos(angle - Math.PI / 2) * r;
    const ty = Math.sin(angle - Math.PI / 2) * r;
    const scale = 0.6 + 0.5 * Math.sin(s * Math.PI);
    return {
      opacity: s > 0 ? Math.sin(s * Math.PI) : 0.5,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  const shimmerProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 1);
    const opacity = p > 0 ? (1 - p) * 0.8 : 0.6;
    const tx = p * 6 - 3;
    return {
      opacity,
      transform: [{ translateX: tx }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#38bdf8'} opacity={0.1} />
      {/* Orbiting satellites */}
      <AnimatedCircle cx="12" cy="14" r="1.1" fill={active ? '#ffffff' : '#7dd3fc'} animatedProps={sat1Props} />
      <AnimatedCircle cx="12" cy="14" r="0.8" fill={active ? '#ffffff' : '#bae6fd'} animatedProps={sat2Props} />
      {/* Main drop */}
      <AnimatedG animatedProps={mainProps}>
        <Path
          d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z"
          fill={fill}
        />
        {!active && <Path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z" fill={`url(#shine-${name})`} />}
        {/* Shimmer */}
        <AnimatedEllipse
          cx="10"
          cy="13.5"
          rx="1.5"
          ry="2.2"
          fill={active ? '#ffffff55' : '#7dd3fc'}
          transform="rotate(-15 10 13.5)"
          animatedProps={shimmerProps}
        />
        <Circle cx="14" cy="11" r="0.9" fill={active ? '#ffffff66' : '#bae6fd'} />
      </AnimatedG>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ZAP ICON — big flash, bolt surge, sparks fly out
// ═══════════════════════════════════════════════════════════════════════

function ZapIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const flashProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const opacity = s > 0 && s < 0.7 ? (1 - s / 0.7) * 0.9 : 0;
    const scale = 1 + s * 1.2;
    return {
      opacity,
      transform: [
        { translateX: 12 },
        { translateY: 12 },
        { scale },
        { translateX: -12 },
        { translateY: -12 },
      ],
    };
  });

  const boltProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = 1 + 0.35 * pulse;
    const rot = 5 * Math.sin(s * Math.PI * 2);
    return {
      transform: [
        { translateX: 12 },
        { translateY: 12 },
        { scale },
        { rotate: `${rot}deg` },
        { translateX: -12 },
        { translateY: -12 },
      ],
    };
  });

  const spark1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.1, 0.9);
    const tx = p * 8;
    const ty = -p * 6;
    const scale = p > 0 ? (1 - p) * 1.2 : 0;
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  const spark2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.15, 0.95);
    const tx = -p * 7;
    const ty = p * 5;
    const scale = p > 0 ? (1 - p) * 1.2 : 0;
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#fde047'} opacity={0.18} />
      {/* Expanding flash */}
      <AnimatedCircle cx="12" cy="12" r="10" fill={active ? '#ffffff' : '#fef9c3'} animatedProps={flashProps} />
      {/* Sparks */}
      <AnimatedCircle cx="3" cy="20" r="1" fill={active ? '#ffffff' : '#fbbf24'} animatedProps={spark1Props} />
      <AnimatedCircle cx="20" cy="4" r="0.9" fill={active ? '#ffffff' : '#fbbf24'} animatedProps={spark2Props} />
      {/* Main bolt */}
      <AnimatedG animatedProps={boltProps}>
        <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={fill} />
        {!active && <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={`url(#shine-${name})`} />}
        <Path d="M10 9l3-1.5 1 3-3 1.5-1-3z" fill={active ? '#ffffff55' : '#fef08a'} />
      </AnimatedG>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GRID ICON — 4 tiles scatter diagonally with rotation, bounce back
// ═══════════════════════════════════════════════════════════════════════

function GridIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const makeTileProps = (dirX: number, dirY: number, delay: number) =>
    useAnimatedProps(() => {
      const s = selectProgress.value;
      const p = sub(s, delay, delay + 0.5);
      const dist = Math.sin(p * Math.PI) * 5;
      const rot = Math.sin(p * Math.PI) * 25 * dirX * dirY;
      const scale = 1 + 0.15 * Math.sin(p * Math.PI);
      return {
        transform: [
          { translateX: dist * dirX },
          { translateY: dist * dirY },
          { rotate: `${rot}deg` },
          { scale },
        ],
      };
    });

  const tlProps = makeTileProps(-1, -1, 0);
  const trProps = makeTileProps(1, -1, 0.05);
  const blProps = makeTileProps(-1, 1, 0.1);
  const brProps = makeTileProps(1, 1, 0.15);

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={tlProps}>
        <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedG animatedProps={trProps}>
        <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedG animatedProps={blProps}>
        <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedG animatedProps={brProps}>
        <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PAINTBRUSH ICON — flick, splatter explodes outward
// ═══════════════════════════════════════════════════════════════════════

function PaintbrushIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const flickProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    let rot = 0;
    if (s > 0 && s <= 0.25) {
      rot = interpolate(s, [0, 0.25], [0, -20]);
    } else if (s > 0.25 && s <= 0.55) {
      rot = interpolate(s, [0.25, 0.55], [-20, 35]);
    } else if (s > 0.55) {
      rot = interpolate(s, [0.55, 1], [35, 0]);
    }
    return {
      transform: [
        { translateX: 2 },
        { translateY: 19 },
        { rotate: `${rot}deg` },
        { translateX: -2 },
        { translateY: -19 },
      ],
    };
  });

  const splatter1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.3, 0.95);
    const tx = p * 9;
    const ty = -p * 7;
    const scale = p > 0 ? easeOutBack(p) * 1.3 : 0;
    return {
      opacity: p > 0 ? 1 - sub(s, 0.7, 1) : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  const splatter2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.35, 1);
    const tx = p * 6;
    const ty = -p * 10;
    const scale = p > 0 ? easeOutBack(p) : 0;
    return {
      opacity: p > 0 ? 1 - sub(s, 0.75, 1) : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  const splatter3Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.4, 1);
    const tx = -p * 5;
    const ty = -p * 8;
    const scale = p > 0 ? easeOutBack(p) * 0.9 : 0;
    return {
      opacity: p > 0 ? 1 - sub(s, 0.8, 1) : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#a78bfa'} opacity={0.1} />
      {/* Splatter drops */}
      <AnimatedCircle cx="22" cy="3" r="1.3" fill={active ? '#ffffff' : g?.mid || '#a78bfa'} animatedProps={splatter1Props} />
      <AnimatedCircle cx="20" cy="1" r="0.9" fill={active ? '#ffffff' : g?.mid || '#a78bfa'} animatedProps={splatter2Props} />
      <AnimatedCircle cx="2" cy="2" r="0.8" fill={active ? '#ffffff' : g?.mid || '#a78bfa'} animatedProps={splatter3Props} />
      {/* Brush body */}
      <AnimatedG animatedProps={flickProps}>
        <Path
          d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z"
          fill={fill}
        />
        {!active && (
          <Path
            d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z"
            fill={`url(#shine-${name})`}
          />
        )}
        <Rect
          x="3.5"
          y="14.5"
          width="7"
          height="2"
          rx="1"
          fill={active ? '#ffffff66' : '#c4b5fd'}
          transform="rotate(-30 7 15.5)"
        />
      </AnimatedG>
      {/* Static drips */}
      <Circle cx="2" cy="19" r="0.8" fill={active ? '#ffffff44' : '#a78bfa'} />
      <Circle cx="5" cy="21" r="0.6" fill={active ? '#ffffff33' : '#c4b5fd'} />
      <Circle cx="8" cy="20" r="0.5" fill={active ? '#ffffff22' : '#ddd6fe'} />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TREES ICON — trunk grows, foliage puffs, apples bounce
// ═══════════════════════════════════════════════════════════════════════

function TreesIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const trunkProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const scaleY = 1 + 0.5 * Math.sin(s * Math.PI);
    return {
      transform: [
        { translateX: 12 },
        { translateY: 21 },
        { scaleY },
        { translateX: -12 },
        { translateY: -21 },
      ],
    };
  });

  const foliageProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const scale = 1 + 0.4 * Math.sin(s * Math.PI);
    const rot = 2 * Math.sin(s * Math.PI * 2);
    return {
      transform: [
        { translateX: 12 },
        { translateY: 10 },
        { scale },
        { rotate: `${rot}deg` },
        { translateX: -12 },
        { translateY: -10 },
      ],
    };
  });

  const apple1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 0.8);
    const scale = 1 + 0.7 * easeOutBack(p) * Math.sin(s * Math.PI);
    const ty = -2 * easeOutCubic(p);
    return {
      transform: [{ translateX: 9 }, { translateY: 8 + ty }, { scale }, { translateX: -9 }, { translateY: -(8 + ty) }],
    };
  });

  const apple2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.35, 0.95);
    const scale = 1 + 0.7 * easeOutBack(p) * Math.sin(s * Math.PI);
    const ty = -2 * easeOutCubic(p);
    return {
      transform: [{ translateX: 15 }, { translateY: 11 + ty }, { scale }, { translateX: -15 }, { translateY: -(11 + ty) }],
    };
  });

  // Falling leaf
  const leafProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.5, 1);
    const tx = p * 6;
    const ty = p * 8;
    const rot = p * 360;
    const opacity = p > 0 ? 1 - sub(s, 0.85, 1) : 0;
    return {
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${rot}deg` }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#34d399'} opacity={0.1} />
      <AnimatedG animatedProps={trunkProps}>
        <Rect x="10.5" y="19" width="3" height="3" rx="0.5" fill={active ? '#ffffffaa' : '#a16207'} />
      </AnimatedG>
      <AnimatedG animatedProps={foliageProps}>
        <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={fill} />
        {!active && <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedCircle cx="9" cy="8" r="1.3" fill={active ? '#ffffff' : '#6ee7b7'} animatedProps={apple1Props} />
      <AnimatedCircle cx="15" cy="11" r="1" fill={active ? '#ffffff' : '#6ee7b7'} animatedProps={apple2Props} />
      {/* Falling leaf */}
      {!active && (
        <AnimatedPath
          d="M11 6c0-1 1-1.5 1.5-1c0.5-0.5 1.5 0 1.5 1c0 1-1 2-1.5 2.5c-0.5-0.5-1.5-1.5-1.5-2.5z"
          fill={g?.mid || '#34d399'}
          animatedProps={leafProps}
        />
      )}
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// WIND ICON — spin with scale pulse, flow lines
// ═══════════════════════════════════════════════════════════════════════

function WindIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const spinProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const rotation = s * 540;
    const scale = 1 + 0.25 * Math.sin(s * Math.PI);
    return {
      transform: [
        { translateX: 12 },
        { translateY: 12 },
        { scale },
        { rotate: `${rotation}deg` },
        { translateX: -12 },
        { translateY: -12 },
      ],
    };
  });

  // Flow line 1
  const flow1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.1, 0.9);
    const opacity = p > 0 ? (1 - p) * 0.7 : 0;
    const tx = -p * 8;
    return {
      opacity,
      transform: [{ translateX: tx }],
    };
  });

  const flow2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 1);
    const opacity = p > 0 ? (1 - p) * 0.7 : 0;
    const tx = p * 8;
    return {
      opacity,
      transform: [{ translateX: tx }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#22d3ee'} opacity={0.12} />
      {/* Flow lines */}
      <AnimatedPath
        d="M2 10h6"
        stroke={active ? '#ffffff' : '#67e8f9'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animatedProps={flow1Props}
      />
      <AnimatedPath
        d="M16 14h6"
        stroke={active ? '#ffffff' : '#67e8f9'}
        strokeWidth="1.5"
        strokeLinecap="round"
        animatedProps={flow2Props}
      />
      <AnimatedG animatedProps={spinProps}>
        <G>
          <Circle cx="12" cy="5" r="1.4" fill={fill} />
          <Circle cx="19" cy="12" r="1.4" fill={fill} />
          <Circle cx="12" cy="19" r="1.4" fill={fill} />
          <Circle cx="5" cy="12" r="1.4" fill={fill} />
          <Path d="M12 5a7 7 0 017 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <Path d="M5 12a7 7 0 007 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <Path d="M19 12a7 7 0 01-7 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <Path d="M12 5a7 7 0 00-7 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </G>
      </AnimatedG>
      <Circle cx="12" cy="12" r="2.8" fill={fill} />
      {!active && <Circle cx="11" cy="11" r="1" fill="#ffffff" opacity={0.5} />}
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// WAREHOUSE ICON — roof drops with bounce, door rolls up, light glows
// ═══════════════════════════════════════════════════════════════════════

function WarehouseIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const roofProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    let ty = 0;
    if (s > 0 && s < 0.7) {
      const p = sub(s, 0, 0.7);
      ty = interpolate(p, [0, 0.5, 0.75, 0.9, 1], [-10, 0, -3, -0.5, 0]);
    }
    return {
      transform: [{ translateY: ty }],
    };
  });

  const doorProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.3, 0.9);
    const scaleY = 1 - 0.7 * easeOutCubic(p);
    return {
      transform: [{ translateX: 12 }, { translateY: 17.5 }, { scaleY }, { translateX: -12 }, { translateY: -17.5 }],
    };
  });

  const lightProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.4, 1);
    const opacity = p > 0 ? 0.4 + 0.6 * easeOutCubic(p) : 0.5;
    return { opacity };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#fb923c'} opacity={0.1} />
      <Path d="M3 21V9l9-7 9 7v12H3z" fill={fill} opacity={0.3} />
      <AnimatedG animatedProps={roofProps}>
        <Path d="M2 10l10-8 10 8" stroke={fill} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </AnimatedG>
      <Path d="M4 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M20 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M4 10h16" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      {/* Door opening glow */}
      <AnimatedRect x="9" y="14" width="6" height="7" rx="0.5" fill={active ? '#ffffff' : '#fbbf24'} opacity={0.3} animatedProps={lightProps} />
      <AnimatedRect x="9" y="14" width="6" height="7" rx="0.5" fill={fill} animatedProps={doorProps} />
      {/* Window */}
      <AnimatedRect x="5" y="12" width="2.5" height="2" rx="0.3" fill={active ? '#ffffff' : '#fde68a'} animatedProps={lightProps} />
      <AnimatedRect x="16.5" y="12" width="2.5" height="2" rx="0.3" fill={active ? '#ffffff' : '#fde68a'} animatedProps={lightProps} />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SPARKLES ICON — 3 stars twinkle in sequence with rays
// ═══════════════════════════════════════════════════════════════════════

function SparklesIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const star1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(sub(s, 0, 0.6) * Math.PI);
    const scale = 1 + 0.5 * pulse;
    const rot = 90 * Math.sin(s * Math.PI);
    return {
      transform: [
        { translateX: 12 },
        { translateY: 9 },
        { scale },
        { rotate: `${rot}deg` },
        { translateX: -12 },
        { translateY: -9 },
      ],
    };
  });

  const star2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(sub(s, 0.15, 0.75) * Math.PI);
    const scale = 1 + 0.6 * pulse;
    const rot = -120 * Math.sin(s * Math.PI);
    return {
      transform: [
        { translateX: 18 },
        { translateY: 18 },
        { scale },
        { rotate: `${rot}deg` },
        { translateX: -18 },
        { translateY: -18 },
      ],
    };
  });

  const star3Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(sub(s, 0.3, 0.9) * Math.PI);
    const scale = 1 + 0.55 * pulse;
    const rot = 100 * Math.sin(s * Math.PI);
    return {
      transform: [
        { translateX: 6 },
        { translateY: 19 },
        { scale },
        { rotate: `${rot}deg` },
        { translateX: -6 },
        { translateY: -19 },
      ],
    };
  });

  // Burst rays
  const raysProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const opacity = s > 0 && s < 0.8 ? Math.sin(s * Math.PI) * 0.6 : 0;
    const scale = 1 + s * 0.5;
    return {
      opacity,
      transform: [{ translateX: 12 }, { translateY: 9 }, { scale }, { translateX: -12 }, { translateY: -9 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#f472b6'} opacity={0.1} />
      {/* Burst rays */}
      <AnimatedG animatedProps={raysProps}>
        <Path d="M12 4v3M12 14v3M7 9H4M20 9h-3" stroke={active ? '#ffffff' : '#fbcfe8'} strokeWidth="1" strokeLinecap="round" />
      </AnimatedG>
      <AnimatedG animatedProps={star1Props}>
        <Path d="M12 2l1.8 5.5L19.5 9l-5.5 1.8L12 16l-1.8-5.5L4.5 9l5.5-1.8L12 2z" fill={fill} />
        {!active && <Path d="M12 2l1.8 5.5L19.5 9l-5.5 1.8L12 16l-1.8-5.5L4.5 9l5.5-1.8L12 2z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedG animatedProps={star2Props}>
        <Path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill={fill} />
      </AnimatedG>
      <AnimatedG animatedProps={star3Props}>
        <Path d="M6 16l0.7 2.3 2.3.7-2.3.7L6 22l-0.7-2.3L3 19l2.3-.7L6 16z" fill={fill} />
      </AnimatedG>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// WRENCH ICON — tighten with overshoot, spark on tight point
// ═══════════════════════════════════════════════════════════════════════

function WrenchIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const tightenProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    let rot = 0;
    if (s > 0 && s <= 0.2) {
      rot = interpolate(s, [0, 0.2], [0, -15]);
    } else if (s > 0.2 && s <= 0.5) {
      rot = interpolate(s, [0.2, 0.5], [-15, 60]);
    } else if (s > 0.5 && s <= 0.7) {
      rot = interpolate(s, [0.5, 0.7], [60, 50]);
    } else if (s > 0.7) {
      rot = interpolate(s, [0.7, 1], [50, 0]);
    }
    return {
      transform: [
        { translateX: 17 },
        { translateY: 7 },
        { rotate: `${rot}deg` },
        { translateX: -17 },
        { translateY: -7 },
      ],
    };
  });

  const sparkProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.45, 0.75);
    const opacity = p > 0 ? Math.sin(p * Math.PI) : 0;
    const scale = p > 0 ? easeOutBack(p) * 1.5 : 0;
    return {
      opacity,
      transform: [{ translateX: 7 }, { translateY: 17 }, { scale }, { translateX: -7 }, { translateY: -17 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#94a3b8'} opacity={0.1} />
      {/* Spark burst at bolt */}
      <AnimatedG animatedProps={sparkProps}>
        <Path d="M7 14l-1-2M7 17l-2 1M5 16l-2 0M7 19l-1 2" stroke={active ? '#ffffff' : '#fbbf24'} strokeWidth="1.2" strokeLinecap="round" />
        <Circle cx="7" cy="17" r="1.2" fill={active ? '#ffffff' : '#fde047'} />
      </AnimatedG>
      <AnimatedG animatedProps={tightenProps}>
        <Path
          d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z"
          fill={fill}
        />
        {!active && (
          <Path
            d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z"
            fill={`url(#shine-${name})`}
          />
        )}
        <Circle cx="16.5" cy="7.5" r="1.2" fill={active ? '#ffffff55' : '#cbd5e1'} />
      </AnimatedG>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HAMMER ICON — swing down hard, impact shake, dust particles
// ═══════════════════════════════════════════════════════════════════════

function HammerIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const swingProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    let rot = 0;
    if (s > 0 && s <= 0.25) {
      rot = interpolate(s, [0, 0.25], [0, -35]);
    } else if (s > 0.25 && s <= 0.45) {
      rot = interpolate(s, [0.25, 0.45], [-35, 55]);
    } else if (s > 0.45 && s <= 0.6) {
      rot = interpolate(s, [0.45, 0.6], [55, 45]);
    } else if (s > 0.6) {
      rot = interpolate(s, [0.6, 1], [45, 0]);
    }
    return {
      transform: [
        { translateX: 4 },
        { translateY: 20 },
        { rotate: `${rot}deg` },
        { translateX: -4 },
        { translateY: -20 },
      ],
    };
  });

  // Impact dust
  const dust1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.45, 1);
    const tx = -p * 6;
    const ty = -p * 3;
    const scale = p > 0 ? (1 - p) * 1.5 : 0;
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  const dust2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.48, 1);
    const tx = p * 5;
    const ty = -p * 4;
    const scale = p > 0 ? (1 - p) * 1.3 : 0;
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  const dust3Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.5, 1);
    const tx = -p * 4;
    const ty = -p * 5;
    const scale = p > 0 ? (1 - p) * 1.1 : 0;
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={g?.mid || '#b45309'} opacity={0.1} />
      {/* Dust particles */}
      <AnimatedCircle cx="4" cy="17" r="0.9" fill={active ? '#ffffff' : '#d97706'} animatedProps={dust1Props} />
      <AnimatedCircle cx="4" cy="16" r="0.7" fill={active ? '#ffffff' : '#fbbf24'} animatedProps={dust2Props} />
      <AnimatedCircle cx="3" cy="18" r="0.6" fill={active ? '#ffffff' : '#fcd34d'} animatedProps={dust3Props} />
      <AnimatedG animatedProps={swingProps}>
        <Path
          d="M10.5 10.5S8 11 6 13c-2 2-2.5 4.5-2.5 4.5l-1 4s2 0 4-1.5c2-1.5 3-4 3-4"
          stroke={fill}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M14.7 6.3l5.5 5.5c.8.8.8 2 0 2.8l-1.4 1.4c-.8.8-2 .8-2.8 0L10.5 10.5"
          stroke={fill}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect x="11" y="3" width="8" height="6" rx="1.5" transform="rotate(45 15 6)" fill={fill} />
        {!active && <Rect x="11" y="3" width="8" height="6" rx="1.5" transform="rotate(45 15 6)" fill={`url(#shine-${name})`} />}
        <Rect x="12.5" y="4.5" width="5" height="3" rx="1" transform="rotate(45 15 6)" fill={active ? '#ffffff44' : '#92400e'} opacity={0.5} />
      </AnimatedG>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ICON REGISTRY
// ═══════════════════════════════════════════════════════════════════════

const ICON_COMPONENTS: Record<string, React.FC<IconProps>> = {
  home: HomeIcon,
  droplets: DropletsIcon,
  zap: ZapIcon,
  grid: GridIcon,
  paintbrush: PaintbrushIcon,
  trees: TreesIcon,
  wind: WindIcon,
  warehouse: WarehouseIcon,
  sparkles: SparklesIcon,
  wrench: WrenchIcon,
  hammer: HammerIcon,
};

function CustomIcon({ name, active, selectProgress }: { name: string; active: boolean; selectProgress: SharedValue<number> }) {
  const g = catGradients[name];
  const IconComp = ICON_COMPONENTS[name];
  if (!IconComp || !g) return null;
  return <IconComp name={name} active={active} selectProgress={selectProgress} g={g} />;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN CATEGORY ICON COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export const CategoryIcon = memo(function CategoryIcon({
  name,
  active,
  index = 0,
  size = 48,
  label,
  onClick,
}: {
  name: string;
  active: boolean;
  index?: number;
  size?: number;
  label?: string;
  onClick?: (name: string) => void;
}) {
  const config = catGradients[name];
  const activeBgColor = catActiveBg[name];
  const cfg3D = icon3D[name] || icon3D.grid;

  // ── Animation Values ──
  const progress = useSharedValue(0);
  const floatVal = useSharedValue(cfg3D.phaseOffset);
  const pressScale = useSharedValue(1);
  const selectProgress = useSharedValue(0);
  const glowVal = useSharedValue(0);
  const mountedRef = useRef(false);

  // ── Entrance Animation (always plays on mount) ──
  useEffect(() => {
    progress.value = 0;
    const delay = index * 90;

    // Pop-in with overshoot
    progress.value = withDelay(
      delay,
      withSpring(1, {
        damping: 9,
        stiffness: 75,
        mass: 1,
      })
    );

    // Trigger selection on mount if active
    if (active) {
      selectProgress.value = 0;
      selectProgress.value = withDelay(
        delay + 350,
        withTiming(1, { duration: 1100, easing: Easing.bezier(0.25, 1, 0.5, 1) })
      );
    }

    // Idle float — start after entrance settles
    const floatStartDelay = delay + 700;
    floatVal.value = cfg3D.phaseOffset;
    floatVal.value = withDelay(
      floatStartDelay,
      withRepeat(
        withSequence(
          withTiming(1 + cfg3D.phaseOffset, { duration: cfg3D.floatSpeed / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0 + cfg3D.phaseOffset, { duration: cfg3D.floatSpeed / 2, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, [name, index, cfg3D.floatSpeed, cfg3D.phaseOffset]);

  // ── Selection Animation Trigger on active change ──
  useEffect(() => {
    if (!mountedRef.current) return;
    if (active) {
      selectProgress.value = 0;
      selectProgress.value = withTiming(1, { duration: 1100, easing: Easing.bezier(0.25, 1, 0.5, 1) });
      // Glow burst
      glowVal.value = 0;
      glowVal.value = withSequence(
        withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
      );
    } else {
      selectProgress.value = withTiming(0, { duration: 300 });
    }
  }, [active]);

  // ── Press handlers ──
  const handlePressIn = () => {
    pressScale.value = withSpring(0.85, { damping: 15, stiffness: 400 });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 350 });
  };
  const handlePress = () => {
    onClick?.(name);
    // Re-trigger selection animation on tap
    selectProgress.value = 0;
    selectProgress.value = withTiming(1, { duration: 1100, easing: Easing.bezier(0.25, 1, 0.5, 1) });
    glowVal.value = 0;
    glowVal.value = withSequence(
      withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
  };

  // ── Container Animated Style ──
  const animatedStyle = useAnimatedStyle(() => {
    // 1. Arrival/Entrance
    const scale = interpolate(progress.value, [0, 0.5, 0.8, 1], [0.2, 0.7, 1.12, 1]);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0, 0.6, 1]);
    const rotateX = interpolate(progress.value, [0, 0.5, 1], [60, 25, 0]);
    const rotateY = interpolate(progress.value, [0, 0.5, 1], [-35, -15, 0]);
    const translateYEntrance = interpolate(progress.value, [0, 1], [-30, 0]);

    // 2. Idle Float — multi-axis with rotation
    const floatPhase = floatVal.value - cfg3D.phaseOffset;
    const floatY = interpolate(floatPhase, [0, 1], [0, -cfg3D.floatAmpY]);
    const floatX = interpolate(floatPhase, [0, 1], [0, cfg3D.floatAmpX]);
    const floatRot = interpolate(floatPhase, [0, 1], [0, cfg3D.floatRot]);

    // 3. Impact shake for hammer/zap on selection
    const s = selectProgress.value;
    let shakeX = 0;
    let shakeY = 0;
    if (s > 0 && s < 0.7) {
      if (name === 'hammer') {
        const hit = sub(s, 0.4, 0.6);
        if (hit > 0 && hit < 1) {
          shakeX = Math.sin(hit * Math.PI * 6) * 4;
          shakeY = Math.sin(hit * Math.PI * 8) * 2;
        }
      } else if (name === 'zap') {
        const hit = sub(s, 0.1, 0.4);
        if (hit > 0 && hit < 1) {
          shakeX = Math.sin(hit * Math.PI * 10) * 2.5;
          shakeY = Math.sin(hit * Math.PI * 8) * 1.5;
        }
      } else if (name === 'wrench') {
        const hit = sub(s, 0.45, 0.65);
        if (hit > 0 && hit < 1) {
          shakeX = Math.sin(hit * Math.PI * 8) * 2;
        }
      }
    }

    return {
      opacity,
      transform: [
        { perspective: 1000 },
        { translateY: translateYEntrance + floatY + shakeY },
        { translateX: floatX + shakeX },
        { rotateX: `${rotateX + floatRot * 0.3}deg` },
        { rotateY: `${rotateY}deg` },
        { rotateZ: `${floatRot}deg` },
        { scale: scale * pressScale.value * (active ? 1.12 : 1) },
      ],
    };
  });

  // ── Glow style for active/selection burst ──
  const glowStyle = useAnimatedStyle(() => {
    const baseGlow = active ? 0.4 : 0;
    const burstGlow = glowVal.value * 0.6;
    const totalGlow = baseGlow + burstGlow;
    return {
      opacity: totalGlow,
      transform: [{ scale: 1 + glowVal.value * 0.3 }],
    };
  });

  if (!config || !activeBgColor) return null;

  return (
    <View
      className="items-center"
      style={{ gap: 8, paddingVertical: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label || name}
      accessibilityState={{ selected: active }}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={{ padding: 6 }}
      >
        <Animated.View
          className={`rounded-2xl items-center justify-center ${active ? activeBgColor : config.bg}`}
          style={[
            { width: size, height: size },
            animatedStyle,
            !active && {
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.45)',
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 5 },
                  shadowOpacity: 0.18,
                  shadowRadius: 8,
                },
                android: { elevation: 6 },
              }),
            },
            active && {
              ...Platform.select({
                ios: {
                  shadowColor: config.glow,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.55,
                  shadowRadius: 12,
                },
                android: { elevation: 10 },
              }),
            },
          ]}
        >
          {/* Glow burst overlay */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                inset: -8,
                borderRadius: 24,
                backgroundColor: config.glow,
              },
              glowStyle,
            ]}
          />
          <CustomIcon name={name} active={active} selectProgress={selectProgress} />
        </Animated.View>
      </Pressable>

      {label && (
        <Text
          className={`text-[10px] font-semibold tracking-tight ${
            active ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {label}
        </Text>
      )}
    </View>
  );
});

export default CategoryIcon;
