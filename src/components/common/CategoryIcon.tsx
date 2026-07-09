import React, { useEffect, memo, useCallback, useRef } from 'react';
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
// WORKLETS — character animation easing
// ═══════════════════════════════════════════════════════════════════════

const easeOutBack = (t: number, c = 1.70158) => {
  'worklet';
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const easeOutCubic = (t: number) => {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
};
const easeOutExpo = (t: number) => {
  'worklet';
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
};
const easeInOutSine = (t: number) => {
  'worklet';
  return -(Math.cos(Math.PI * t) - 1) / 2;
};
const sub = (t: number, s: number, e: number) => {
  'worklet';
  return Math.max(0, Math.min(1, (t - s) / (e - s)));
};

const EASE_STANDARD = Easing.bezier(0.4, 0, 0.2, 1);
const EASE_DECELERATE = Easing.bezier(0, 0, 0.2, 1);
const EASE_SPRING = { damping: 14, stiffness: 180, mass: 0.9 };

const SVG_PROPS = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none' as const };

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION — refined claymorphic palette
// ═══════════════════════════════════════════════════════════════════════

export const catGradients: Record<
  string,
  { from: string; to: string; mid: string; solid: string; glow: string; glowStrong: string }
> = {
  grid:       { from: '#a1a1aa', to: '#52525b', mid: '#71717a', solid: '#52525b', glow: 'rgba(113,113,122,0.45)',  glowStrong: 'rgba(113,113,122,0.7)' },
  home:       { from: '#fbbf24', to: '#b45309', mid: '#f59e0b', solid: '#d97706', glow: 'rgba(245,158,11,0.5)',   glowStrong: 'rgba(245,158,11,0.8)' },
  droplets:   { from: '#38bdf8', to: '#0369a1', mid: '#0ea5e9', solid: '#0284c7', glow: 'rgba(14,165,233,0.5)',   glowStrong: 'rgba(14,165,233,0.8)' },
  zap:        { from: '#fde047', to: '#a16207', mid: '#eab308', solid: '#ca8a04', glow: 'rgba(234,179,8,0.55)',    glowStrong: 'rgba(234,179,8,0.85)' },
  paintbrush: { from: '#a78bfa', to: '#6d28d9', mid: '#8b5cf6', solid: '#7c3aed', glow: 'rgba(139,92,246,0.5)',   glowStrong: 'rgba(139,92,246,0.8)' },
  trees:      { from: '#34d399', to: '#047857', mid: '#10b981', solid: '#059669', glow: 'rgba(16,185,129,0.5)',   glowStrong: 'rgba(16,185,129,0.8)' },
  wind:       { from: '#22d3ee', to: '#0e7490', mid: '#06b6d4', solid: '#0891b2', glow: 'rgba(6,182,212,0.5)',    glowStrong: 'rgba(6,182,212,0.8)' },
  warehouse:  { from: '#fb923c', to: '#c2410c', mid: '#f97316', solid: '#ea580c', glow: 'rgba(249,115,22,0.5)',   glowStrong: 'rgba(249,115,22,0.8)' },
  sparkles:   { from: '#f472b6', to: '#be185d', mid: '#ec4899', solid: '#db2777', glow: 'rgba(236,72,153,0.5)',   glowStrong: 'rgba(236,72,153,0.85)' },
  wrench:     { from: '#94a3b8', to: '#334155', mid: '#64748b', solid: '#475569', glow: 'rgba(100,116,139,0.45)', glowStrong: 'rgba(100,116,139,0.7)' },
  hammer:     { from: '#b45309', to: '#451a03', mid: '#92400e', solid: '#92400e', glow: 'rgba(146,64,14,0.5)',    glowStrong: 'rgba(146,64,14,0.75)' },
};

export const catActiveBg: Record<string, string> = {
  grid: 'bg-neutral-700 dark:bg-neutral-200',
  home: 'bg-amber-500',
  droplets: 'bg-sky-500',
  zap: 'bg-yellow-500',
  paintbrush: 'bg-violet-500',
  trees: 'bg-emerald-500',
  wind: 'bg-cyan-500',
  warehouse: 'bg-orange-500',
  sparkles: 'bg-pink-500',
  wrench: 'bg-slate-600',
  hammer: 'bg-amber-700',
};

// Inactive = soft neutral with depth, not flat
const INACTIVE_BG = 'bg-neutral-50 dark:bg-neutral-900';

// Idle animation config — alive but calm
type IdleConfig = { breathe: number; breatheSpeed: number; sway: number; swaySpeed: number };
const idleConfig: Record<string, IdleConfig> = {
  home:       { breathe: 0.015, breatheSpeed: 4000, sway: 0, swaySpeed: 0 },
  droplets:   { breathe: 0.02,  breatheSpeed: 3500, sway: 0, swaySpeed: 0 },
  hammer:     { breathe: 0.01,  breatheSpeed: 4500, sway: 0.5, swaySpeed: 5000 },
  zap:        { breathe: 0.025, breatheSpeed: 3000, sway: 0, swaySpeed: 0 },
  trees:      { breathe: 0.01,  breatheSpeed: 5000, sway: 1, swaySpeed: 4000 },
  wind:       { breathe: 0,     breatheSpeed: 0,    sway: 0, swaySpeed: 0 }, // wind has its own spin
  sparkles:   { breathe: 0.02,  breatheSpeed: 3200, sway: 0, swaySpeed: 0 },
  wrench:     { breathe: 0.01,  breatheSpeed: 4500, sway: 0.3, swaySpeed: 5500 },
  warehouse:  { breathe: 0.008, breatheSpeed: 5500, sway: 0, swaySpeed: 0 },
  paintbrush: { breathe: 0.012, breatheSpeed: 4200, sway: 0.6, swaySpeed: 4500 },
  grid:       { breathe: 0.01,  breatheSpeed: 4800, sway: 0, swaySpeed: 0 },
};

// ═══════════════════════════════════════════════════════════════════════
// SHARED GRADIENT DEF — memoized
// ═══════════════════════════════════════════════════════════════════════

const GradientDef = memo(function GradientDef({
  name,
  g,
}: {
  name: string;
  g: { from: string; to: string; mid: string };
}) {
  return (
    <Defs>
      <LinearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={g.from} />
        <Stop offset="50%" stopColor={g.mid} />
        <Stop offset="100%" stopColor={g.to} />
      </LinearGradient>
      <RadialGradient id={`shine-${name}`} cx="32%" cy="22%" r="65%">
        <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
        <Stop offset="60%" stopColor="#ffffff" stopOpacity="0.05" />
        <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </RadialGradient>
      <RadialGradient id={`glow-${name}`} cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={g.from} stopOpacity="0.6" />
        <Stop offset="100%" stopColor={g.from} stopOpacity="0" />
      </RadialGradient>
    </Defs>
  );
});

// ═══════════════════════════════════════════════════════════════════════
// CHARACTER ICONS — each tells a tiny story
// ═══════════════════════════════════════════════════════════════════════

type IconProps = {
  active: boolean;
  selectProgress: SharedValue<number>;
  idle: SharedValue<number>;
  name: string;
  g: { from: string; to: string; mid: string };
};

// ─── HOME — chimney smoke puffs, roof lifts, windows light warm, door opens ───
const HomeIcon = memo(function HomeIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Roof lifts up on select, sways subtly on idle
  const roofProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const lift = -3 * Math.sin(s * Math.PI);
    return {
      transform: [
        { translateX: 12 }, { translateY: 8 }, { translateY: lift }, { translateX: -12 }, { translateY: -8 },
      ],
    };
  });

  // Body breathes on idle + pops on select
  const bodyProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pop = 1 + 0.08 * Math.sin(s * Math.PI);
    const breathe = 1 + i * 0.015;
    const scale = pop * breathe;
    return {
      transform: [
        { translateX: 12 }, { translateY: 14 }, { scale }, { translateX: -12 }, { translateY: -14 },
      ],
    };
  });

  // Door opens (scaleX) on select
  const doorProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 0.8);
    const scaleX = 1 - 0.4 * easeOutCubic(p);
    return {
      opacity: 1 - 0.5 * p,
      transform: [{ translateX: 12 }, { translateY: 16 }, { scaleX }, { translateX: -12 }, { translateY: -16 }],
    };
  });

  // Windows light up warm
  const win1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.25, 0.7);
    return { opacity: 0.5 + 0.5 * easeOutCubic(p), fill: active ? '#ffffff' : '#fde68a' };
  });
  const win2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.4, 0.85);
    return { opacity: 0.5 + 0.5 * easeOutCubic(p), fill: active ? '#ffffff' : '#fde68a' };
  });

  // Smoke puffs from chimney
  const smoke1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.1, 1);
    return {
      opacity: p > 0 ? (1 - p) * 0.6 : 0,
      transform: [{ translateY: -p * 6 }, { scale: 0.5 + p * 0.8 }],
    };
  });
  const smoke2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.25, 1);
    return {
      opacity: p > 0 ? (1 - p) * 0.5 : 0,
      transform: [{ translateY: -p * 5 }, { translateX: p * 1.5 }, { scale: 0.5 + p * 0.7 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      {/* Soft halo behind */}
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.3} />
      {/* Smoke */}
      <AnimatedG animatedProps={smoke1Props}>
        <Circle cx="17" cy="4" r="1.1" fill={active ? '#ffffff80' : g.mid} />
      </AnimatedG>
      <AnimatedG animatedProps={smoke2Props}>
        <Circle cx="18.5" cy="2.5" r="0.8" fill={active ? '#ffffff60' : g.mid} />
      </AnimatedG>
      {/* Body shadow + body */}
      <AnimatedG animatedProps={bodyProps}>
        <Path d="M3 21V10h18v11H3z" fill={fill} opacity={0.4} />
        <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={fill} />
        {!active && <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      {/* Roof outline lift */}
      <AnimatedG animatedProps={roofProps}>
        <Path d="M2 12L12 3l10 9" stroke={fill} strokeWidth="0.4" opacity={0.3} fill="none" />
      </AnimatedG>
      {/* Chimney */}
      <Rect x="16" y="5" width="2" height="3" rx="0.3" fill={fill} opacity={0.85} />
      {/* Door */}
      <AnimatedRect x="10.5" y="14" width="3" height="5" rx="0.8" fill={active ? '#ffffff' : '#fcd34d'} animatedProps={doorProps} />
      {/* Windows */}
      <AnimatedRect x="4.5" y="14.5" width="3" height="3" rx="0.5" animatedProps={win1Props} />
      <AnimatedRect x="16.5" y="14.5" width="3" height="3" rx="0.5" animatedProps={win2Props} />
    </Svg>
  );
});

// ─── DROPLETS — main drop squishes + ripples expand + satellites orbit ───
const DropletsIcon = memo(function DropletsIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Main drop squishes with elastic feel
  const mainProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pulse = Math.sin(s * Math.PI);
    const wobble = i * 0.02;
    const scaleY = 1 - 0.15 * pulse + wobble;
    const scaleX = 1 + 0.1 * pulse - wobble;
    return {
      transform: [
        { translateX: 12 }, { translateY: 15 }, { scaleX }, { scaleY }, { translateX: -12 }, { translateY: -15 },
      ],
    };
  });

  // Ripple 1
  const ripple1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.1, 1);
    return {
      opacity: p > 0 ? (1 - p) * 0.5 : 0,
      transform: [{ translateX: 12 }, { translateY: 19 }, { scale: 0.3 + p * 1.5 }, { translateX: -12 }, { translateY: -19 }],
    };
  });

  // Orbiting satellite
  const satProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const angle = s * Math.PI * 2;
    const r = 4 + s * 2.5;
    const tx = Math.cos(angle - Math.PI / 2) * r;
    const ty = Math.sin(angle - Math.PI / 2) * r;
    const scale = 0.6 + 0.6 * Math.sin(s * Math.PI);
    return {
      opacity: s > 0 ? Math.sin(s * Math.PI) : 0.5,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.35} />
      {/* Ripple */}
      <AnimatedEllipse cx="12" cy="19" rx="4" ry="1" fill="none" stroke={active ? '#ffffff' : g.mid} strokeWidth="0.8" animatedProps={ripple1Props} />
      {/* Satellite */}
      <AnimatedCircle cx="12" cy="14" r="1.1" fill={active ? '#ffffff' : '#7dd3fc'} animatedProps={satProps} />
      {/* Main drop */}
      <AnimatedG animatedProps={mainProps}>
        <Path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z" fill={fill} />
        {!active && <Path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z" fill={`url(#shine-${name})`} />}
        <Ellipse cx="10" cy="13.5" rx="1.5" ry="2.2" fill={active ? '#ffffff80' : '#7dd3fc'} transform="rotate(-15 10 13.5)" />
        <Circle cx="14" cy="11" r="0.9" fill={active ? '#ffffffaa' : '#bae6fd'} />
      </AnimatedG>
    </Svg>
  );
});

// ─── ZAP — dark cloud gathers, bolt strikes with multi-branch flash + sparks ───
const ZapIcon = memo(function ZapIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Big flash circle
  const flashProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const opacity = s > 0 && s < 0.6 ? (1 - s / 0.6) * 0.85 : 0;
    const scale = 1 + s * 1.5;
    return {
      opacity,
      transform: [{ translateX: 12 }, { translateY: 12 }, { scale }, { translateX: -12 }, { translateY: -12 }],
    };
  });

  // Bolt with anticipation (slight reverse) then strike
  const boltProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pulse = Math.sin(s * Math.PI);
    const idleGlow = 1 + i * 0.02;
    let scale = 1 + 0.18 * pulse;
    // Anticipation: pull back slightly at start
    if (s > 0 && s < 0.15) scale = 1 - 0.1 * (s / 0.15);
    scale *= idleGlow;
    const rot = 4 * Math.sin(s * Math.PI * 2);
    return {
      transform: [{ translateX: 12 }, { translateY: 12 }, { scale }, { rotate: `${rot}deg` }, { translateX: -12 }, { translateY: -12 }],
    };
  });

  // Sparks fly outward
  const spark1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.15, 0.9);
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: p * 8 }, { translateY: -p * 6 }, { scale: p > 0 ? (1 - p) * 1.3 : 0 }],
    };
  });
  const spark2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 0.95);
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: -p * 7 }, { translateY: p * 5 }, { scale: p > 0 ? (1 - p) * 1.2 : 0 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.4} />
      {/* Flash burst */}
      <AnimatedCircle cx="12" cy="12" r="10" fill={active ? '#ffffff' : '#fef9c3'} animatedProps={flashProps} />
      {/* Sparks */}
      <AnimatedCircle cx="3" cy="20" r="1" fill={active ? '#ffffff' : '#fbbf24'} animatedProps={spark1Props} />
      <AnimatedCircle cx="20" cy="4" r="0.9" fill={active ? '#ffffff' : '#fbbf24'} animatedProps={spark2Props} />
      {/* Bolt */}
      <AnimatedG animatedProps={boltProps}>
        <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={fill} />
        {!active && <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={`url(#shine-${name})`} />}
        <Path d="M10 9l3-1.5 1 3-3 1.5-1-3z" fill={active ? '#ffffffaa' : '#fef08a'} />
      </AnimatedG>
    </Svg>
  );
});

// ─── GRID — wave through 4 tiles with stagger + 3D pop ───
const GridIcon = memo(function GridIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Stagger: TL @ 0, TR @ 0.1, BR @ 0.2, BL @ 0.3
  const makeProps = (delay: number, dirX: number, dirY: number) =>
    useAnimatedProps(() => {
      const s = selectProgress.value;
      const p = sub(s, delay, delay + 0.55);
      const dist = Math.sin(p * Math.PI) * 2.5;
      const scale = 1 + 0.15 * Math.sin(p * Math.PI);
      const rot = Math.sin(p * Math.PI) * 8 * dirX * dirY;
      return {
        transform: [
          { translateX: dist * dirX }, { translateY: dist * dirY }, { rotate: `${rot}deg` }, { scale },
        ],
      };
    });

  const tl = makeProps(0, -1, -1);
  const tr = makeProps(0.1, 1, -1);
  const br = makeProps(0.2, 1, 1);
  const bl = makeProps(0.3, -1, 1);

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.3} />
      <AnimatedG animatedProps={tl}>
        <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedG animatedProps={tr}>
        <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedG animatedProps={br}>
        <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedG animatedProps={bl}>
        <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
    </Svg>
  );
});

// ─── PAINTBRUSH — flick with anticipation + paint splatter arc + drips ───
const PaintbrushIcon = memo(function PaintbrushIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Flick with anticipation (wind up reverse) then follow-through
  const flickProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    let rot = 0;
    if (s > 0 && s <= 0.2) rot = interpolate(s, [0, 0.2], [0, -15]);       // wind up
    else if (s > 0.2 && s <= 0.5) rot = interpolate(s, [0.2, 0.5], [-15, 30]); // strike
    else if (s > 0.5 && s <= 0.7) rot = interpolate(s, [0.5, 0.7], [30, 22]);  // follow-through
    else if (s > 0.7) rot = interpolate(s, [0.7, 1], [22, 0]);                 // settle
    rot += i * 1; // idle sway
    return {
      transform: [{ translateX: 2 }, { translateY: 19 }, { rotate: `${rot}deg` }, { translateX: -2 }, { translateY: -19 }],
    };
  });

  // Splatter 1
  const splat1 = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.35, 1);
    return {
      opacity: p > 0 ? 1 - sub(s, 0.75, 1) : 0,
      transform: [{ translateX: p * 9 }, { translateY: -p * 7 }, { scale: p > 0 ? easeOutBack(p) * 1.3 : 0 }],
    };
  });
  // Splatter 2
  const splat2 = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.4, 1);
    return {
      opacity: p > 0 ? 1 - sub(s, 0.8, 1) : 0,
      transform: [{ translateX: p * 6 }, { translateY: -p * 10 }, { scale: p > 0 ? easeOutBack(p) : 0 }],
    };
  });
  // Splatter 3
  const splat3 = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.45, 1);
    return {
      opacity: p > 0 ? 1 - sub(s, 0.85, 1) : 0,
      transform: [{ translateX: -p * 5 }, { translateY: -p * 8 }, { scale: p > 0 ? easeOutBack(p) * 0.9 : 0 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.35} />
      {/* Splatter drops */}
      <AnimatedCircle cx="22" cy="3" r="1.3" fill={active ? '#ffffff' : g.mid} animatedProps={splat1} />
      <AnimatedCircle cx="20" cy="1" r="0.9" fill={active ? '#ffffff' : g.mid} animatedProps={splat2} />
      <AnimatedCircle cx="2" cy="2" r="0.8" fill={active ? '#ffffff' : g.mid} animatedProps={splat3} />
      {/* Brush */}
      <AnimatedG animatedProps={flickProps}>
        <Path d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z" fill={fill} />
        {!active && <Path d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z" fill={`url(#shine-${name})`} />}
        <Rect x="3.5" y="14.5" width="7" height="2" rx="1" fill={active ? '#ffffff80' : '#c4b5fd'} transform="rotate(-30 7 15.5)" />
      </AnimatedG>
      {/* Static drips */}
      <Circle cx="2" cy="19" r="0.8" fill={active ? '#ffffff60' : '#a78bfa'} />
      <Circle cx="5" cy="21" r="0.6" fill={active ? '#ffffff40' : '#c4b5fd'} />
      <Circle cx="8" cy="20" r="0.5" fill={active ? '#ffffff30' : '#ddd6fe'} />
    </Svg>
  );
});

// ─── TREES — trunk grows, foliage puffs, apples bounce, leaf falls ───
const TreesIcon = memo(function TreesIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Foliage puffs + sways
  const foliageProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = (1 + 0.18 * pulse) * (1 + i * 0.015);
    const rot = 2 * Math.sin(s * Math.PI * 2) + i * 2;
    return {
      transform: [{ translateX: 12 }, { translateY: 10 }, { scale }, { rotate: `${rot}deg` }, { translateX: -12 }, { translateY: -10 }],
    };
  });

  // Trunk grows
  const trunkProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const scaleY = 1 + 0.3 * Math.sin(s * Math.PI);
    return {
      transform: [{ translateX: 12 }, { translateY: 21 }, { scaleY }, { translateX: -12 }, { translateY: -21 }],
    };
  });

  // Apples bounce in sequence
  const apple1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 0.8);
    const scale = 1 + 0.5 * easeOutBack(p) * Math.sin(s * Math.PI);
    return { transform: [{ translateX: 9 }, { translateY: 8 }, { scale }, { translateX: -9 }, { translateY: -8 }] };
  });
  const apple2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.35, 0.95);
    const scale = 1 + 0.5 * easeOutBack(p) * Math.sin(s * Math.PI);
    return { transform: [{ translateX: 15 }, { translateY: 11 }, { scale }, { translateX: -15 }, { translateY: -11 }] };
  });

  // Falling leaf
  const leafProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.5, 1);
    return {
      opacity: p > 0 ? 1 - sub(s, 0.85, 1) : 0,
      transform: [{ translateX: p * 6 }, { translateY: p * 8 }, { rotate: `${p * 360}deg` }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.35} />
      <AnimatedG animatedProps={trunkProps}>
        <Rect x="10.5" y="19" width="3" height="3" rx="0.5" fill={active ? '#ffffff' : '#a16207'} />
      </AnimatedG>
      <AnimatedG animatedProps={foliageProps}>
        <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={fill} />
        {!active && <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <AnimatedCircle cx="9" cy="8" r="1.3" fill={active ? '#ffffff' : '#6ee7b7'} animatedProps={apple1Props} />
      <AnimatedCircle cx="15" cy="11" r="1" fill={active ? '#ffffff' : '#6ee7b7'} animatedProps={apple2Props} />
      {!active && (
        <AnimatedPath d="M11 6c0-1 1-1.5 1.5-1c0.5-0.5 1.5 0 1.5 1c0 1-1 2-1.5 2.5c-0.5-0.5-1.5-1.5-1.5-2.5z" fill={g.mid} animatedProps={leafProps} />
      )}
    </Svg>
  );
});

// ─── WIND — pinwheel spins with motion blur arcs + flow streaks ───
const WindIcon = memo(function WindIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Continuous spin — faster on selection
  const spinProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value; // idle continues spinning slowly
    const rotation = s * 360 + i * 90;
    const scale = 1 + 0.12 * Math.sin(s * Math.PI);
    return {
      transform: [{ translateX: 12 }, { translateY: 12 }, { scale }, { rotate: `${rotation}deg` }, { translateX: -12 }, { translateY: -12 }],
    };
  });

  // Flow streaks
  const flow1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.1, 0.9);
    return {
      opacity: p > 0 ? (1 - p) * 0.7 : 0,
      transform: [{ translateX: -p * 8 }],
    };
  });
  const flow2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.2, 1);
    return {
      opacity: p > 0 ? (1 - p) * 0.7 : 0,
      transform: [{ translateX: p * 8 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.35} />
      <AnimatedPath d="M2 10h6" stroke={active ? '#ffffff' : '#67e8f9'} strokeWidth="1.5" strokeLinecap="round" animatedProps={flow1Props} />
      <AnimatedPath d="M16 14h6" stroke={active ? '#ffffff' : '#67e8f9'} strokeWidth="1.5" strokeLinecap="round" animatedProps={flow2Props} />
      <AnimatedG animatedProps={spinProps}>
        <Circle cx="12" cy="5" r="1.4" fill={fill} />
        <Circle cx="19" cy="12" r="1.4" fill={fill} />
        <Circle cx="12" cy="19" r="1.4" fill={fill} />
        <Circle cx="5" cy="12" r="1.4" fill={fill} />
        <Path d="M12 5a7 7 0 017 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <Path d="M5 12a7 7 0 007 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <Path d="M19 12a7 7 0 01-7 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <Path d="M12 5a7 7 0 00-7 7" stroke={fill} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </AnimatedG>
      <Circle cx="12" cy="12" r="2.8" fill={fill} />
      {!active && <Circle cx="11" cy="11" r="1" fill="#ffffff" opacity={0.6} />}
    </Svg>
  );
});

// ─── WAREHOUSE — roof drops with bounce, door rolls up, warm light glows ───
const WarehouseIcon = memo(function WarehouseIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Roof drops with bounce
  const roofProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    let ty = 0;
    if (s > 0 && s < 0.6) {
      const p = sub(s, 0, 0.6);
      ty = interpolate(p, [0, 0.5, 0.75, 0.9, 1], [-8, 0, -2, -0.3, 0]);
    }
    return { transform: [{ translateY: ty }] };
  });

  // Door rolls up
  const doorProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.25, 0.85);
    const scaleY = 1 - 0.7 * easeOutCubic(p);
    return { transform: [{ translateX: 12 }, { translateY: 17.5 }, { scaleY }, { translateX: -12 }, { translateY: -17.5 }] };
  });

  // Warm light inside
  const lightProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const p = sub(s, 0.35, 1);
    const flicker = 0.5 + 0.5 * Math.sin(i * 6);
    return { opacity: (0.3 + 0.6 * easeOutCubic(p)) * (0.85 + flicker * 0.15) };
  });

  // Building subtle breathe
  const buildingProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pop = 1 + 0.05 * Math.sin(s * Math.PI);
    const breathe = 1 + i * 0.008;
    return {
      transform: [{ translateX: 12 }, { translateY: 14 }, { scale: pop * breathe }, { translateX: -12 }, { translateY: -14 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.3} />
      <Path d="M3 21V9l9-7 9 7v12H3z" fill={fill} opacity={0.3} />
      <AnimatedG animatedProps={buildingProps}>
        <AnimatedPath d="M2 10l10-8 10 8" stroke={fill} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" animatedProps={roofProps} />
        <Path d="M4 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M20 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M4 10h16" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
      </AnimatedG>
      {/* Warm light inside */}
      <AnimatedRect x="9" y="14" width="6" height="7" rx="0.5" fill={active ? '#ffffff' : '#fbbf24'} opacity={0.4} animatedProps={lightProps} />
      <AnimatedRect x="9" y="14" width="6" height="7" rx="0.5" fill={fill} animatedProps={doorProps} />
      <AnimatedRect x="5" y="12" width="2.5" height="2" rx="0.3" fill={active ? '#ffffff' : '#fde68a'} opacity={0.7} animatedProps={lightProps} />
      <AnimatedRect x="16.5" y="12" width="2.5" height="2" rx="0.3" fill={active ? '#ffffff' : '#fde68a'} opacity={0.7} animatedProps={lightProps} />
    </Svg>
  );
});

// ─── SPARKLES — central star bursts with rays, satellites twinkle in sequence ───
const SparklesIcon = memo(function SparklesIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Central star pulses + rotates
  const star1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pulse = Math.sin(sub(s, 0, 0.6) * Math.PI);
    const idleTwinkle = 1 + Math.sin(i * 4) * 0.05;
    const scale = (1 + 0.25 * pulse) * idleTwinkle;
    const rot = 60 * Math.sin(s * Math.PI);
    return {
      transform: [{ translateX: 12 }, { translateY: 9 }, { scale }, { rotate: `${rot}deg` }, { translateX: -12 }, { translateY: -9 }],
    };
  });

  // Satellite 2
  const star2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pulse = Math.sin(sub(s, 0.15, 0.75) * Math.PI);
    const idleTwinkle = 1 + Math.sin(i * 4 + 1) * 0.05;
    const scale = (1 + 0.35 * pulse) * idleTwinkle;
    const rot = -90 * Math.sin(s * Math.PI);
    return {
      transform: [{ translateX: 18 }, { translateY: 18 }, { scale }, { rotate: `${rot}deg` }, { translateX: -18 }, { translateY: -18 }],
    };
  });

  // Satellite 3
  const star3Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    const pulse = Math.sin(sub(s, 0.3, 0.9) * Math.PI);
    const idleTwinkle = 1 + Math.sin(i * 4 + 2) * 0.05;
    const scale = (1 + 0.3 * pulse) * idleTwinkle;
    const rot = 75 * Math.sin(s * Math.PI);
    return {
      transform: [{ translateX: 6 }, { translateY: 19 }, { scale }, { rotate: `${rot}deg` }, { translateX: -6 }, { translateY: -19 }],
    };
  });

  // Burst rays
  const raysProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const opacity = s > 0 && s < 0.7 ? Math.sin(s * Math.PI) * 0.7 : 0;
    const scale = 1 + s * 0.4;
    return {
      opacity,
      transform: [{ translateX: 12 }, { translateY: 9 }, { scale }, { translateX: -12 }, { translateY: -9 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.4} />
      <AnimatedG animatedProps={raysProps}>
        <Path d="M12 3v3M12 12v3M6 9H3M21 9h-3" stroke={active ? '#ffffff' : '#fbcfe8'} strokeWidth="1" strokeLinecap="round" />
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
});

// ─── WRENCH — tighten with overshoot + spark at bolt + settle ───
const WrenchIcon = memo(function WrenchIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Tighten: wind up, strike, overshoot, settle
  const tightenProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    let rot = 0;
    if (s > 0 && s <= 0.2) rot = interpolate(s, [0, 0.2], [0, -12]);        // wind up
    else if (s > 0.2 && s <= 0.45) rot = interpolate(s, [0.2, 0.45], [-12, 50]); // strike
    else if (s > 0.45 && s <= 0.6) rot = interpolate(s, [0.45, 0.6], [50, 42]);  // overshoot
    else if (s > 0.6) rot = interpolate(s, [0.6, 1], [42, 0]);                   // settle
    rot += i * 0.5;
    return {
      transform: [{ translateX: 17 }, { translateY: 7 }, { rotate: `${rot}deg` }, { translateX: -17 }, { translateY: -7 }],
    };
  });

  // Spark at bolt
  const sparkProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.4, 0.7);
    return {
      opacity: p > 0 ? Math.sin(p * Math.PI) : 0,
      transform: [{ translateX: 7 }, { translateY: 17 }, { scale: p > 0 ? easeOutBack(p) * 1.4 : 0 }, { translateX: -7 }, { translateY: -17 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.3} />
      <AnimatedG animatedProps={sparkProps}>
        <Path d="M7 14l-1-2M7 17l-2 1M5 16l-2 0M7 19l-1 2" stroke={active ? '#ffffff' : '#fbbf24'} strokeWidth="1.2" strokeLinecap="round" />
        <Circle cx="7" cy="17" r="1.3" fill={active ? '#ffffff' : '#fde047'} />
      </AnimatedG>
      <AnimatedG animatedProps={tightenProps}>
        <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z" fill={fill} />
        {!active && <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z" fill={`url(#shine-${name})`} />}
        <Circle cx="16.5" cy="7.5" r="1.2" fill={active ? '#ffffff80' : '#cbd5e1'} />
      </AnimatedG>
    </Svg>
  );
});

// ─── HAMMER — wind up, swing down hard, impact dust, settle ───
const HammerIcon = memo(function HammerIcon({ active, selectProgress, idle, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Swing: wind up, strike, bounce, settle
  const swingProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const i = idle.value;
    let rot = 0;
    if (s > 0 && s <= 0.25) rot = interpolate(s, [0, 0.25], [0, -30]);        // wind up
    else if (s > 0.25 && s <= 0.45) rot = interpolate(s, [0.25, 0.45], [-30, 50]); // strike
    else if (s > 0.45 && s <= 0.6) rot = interpolate(s, [0.45, 0.6], [50, 40]);   // bounce
    else if (s > 0.6) rot = interpolate(s, [0.6, 1], [40, 0]);                    // settle
    rot += i * 0.4;
    return {
      transform: [{ translateX: 4 }, { translateY: 20 }, { rotate: `${rot}deg` }, { translateX: -4 }, { translateY: -20 }],
    };
  });

  // Impact dust particles
  const dust1Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.42, 1);
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: -p * 6 }, { translateY: -p * 3 }, { scale: p > 0 ? (1 - p) * 1.4 : 0 }],
    };
  });
  const dust2Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.45, 1);
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: p * 5 }, { translateY: -p * 4 }, { scale: p > 0 ? (1 - p) * 1.2 : 0 }],
    };
  });
  const dust3Props = useAnimatedProps(() => {
    const s = selectProgress.value;
    const p = sub(s, 0.48, 1);
    return {
      opacity: p > 0 ? 1 - p : 0,
      transform: [{ translateX: -p * 4 }, { translateY: -p * 5 }, { scale: p > 0 ? (1 - p) * 1.1 : 0 }],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Circle cx="12" cy="12" r="11" fill={`url(#glow-${name})`} opacity={active ? 0 : 0.3} />
      {/* Dust */}
      <AnimatedCircle cx="4" cy="17" r="1" fill={active ? '#ffffff' : '#d97706'} animatedProps={dust1Props} />
      <AnimatedCircle cx="4" cy="16" r="0.7" fill={active ? '#ffffff' : '#fbbf24'} animatedProps={dust2Props} />
      <AnimatedCircle cx="3" cy="18" r="0.6" fill={active ? '#ffffff' : '#fcd34d'} animatedProps={dust3Props} />
      <AnimatedG animatedProps={swingProps}>
        <Path d="M10.5 10.5S8 11 6 13c-2 2-2.5 4.5-2.5 4.5l-1 4s2 0 4-1.5c2-1.5 3-4 3-4" stroke={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14.7 6.3l5.5 5.5c.8.8.8 2 0 2.8l-1.4 1.4c-.8.8-2 .8-2.8 0L10.5 10.5" stroke={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="11" y="3" width="8" height="6" rx="1.5" transform="rotate(45 15 6)" fill={fill} />
        {!active && <Rect x="11" y="3" width="8" height="6" rx="1.5" transform="rotate(45 15 6)" fill={`url(#shine-${name})`} />}
        <Rect x="12.5" y="4.5" width="5" height="3" rx="1" transform="rotate(45 15 6)" fill={active ? '#ffffff44' : '#92400e'} opacity={0.5} />
      </AnimatedG>
    </Svg>
  );
});

// ═══════════════════════════════════════════════════════════════════════
// ICON REGISTRY — stable references
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

const CustomIcon = memo(function CustomIcon({
  name,
  active,
  selectProgress,
  idle,
}: {
  name: string;
  active: boolean;
  selectProgress: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const g = catGradients[name];
  const IconComp = ICON_COMPONENTS[name];
  if (!IconComp || !g) return null;
  return <IconComp name={name} active={active} selectProgress={selectProgress} idle={idle} g={g} />;
});

// ═══════════════════════════════════════════════════════════════════════
// MAIN CATEGORY ICON — premium claymorphic shell
// ═══════════════════════════════════════════════════════════════════════

export const CategoryIcon = memo(function CategoryIcon({
  name,
  active,
  index = 0,
  size = 52,
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
  const idleCfg = idleConfig[name] || idleConfig.grid;

  // Animation values
  const entrance = useSharedValue(0);
  const idle = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const selectProgress = useSharedValue(0);
  const glowVal = useSharedValue(0);
  const tiltVal = useSharedValue(0);
  const hasMounted = useRef(false);

  // ── Single entrance on mount ──
  useEffect(() => {
    entrance.value = 0;
    entrance.value = withDelay(
      index * 60,
      withSpring(1, { damping: 12, stiffness: 110, mass: 0.8 })
    );

    // Idle breathing — starts after entrance settles
    idle.value = 0;
    idle.value = withDelay(
      500 + index * 60,
      withRepeat(
        withSequence(
          withTiming(1, { duration: idleCfg.breatheSpeed / 2 || 2500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: idleCfg.breatheSpeed / 2 || 2500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    const t = setTimeout(() => { hasMounted.current = true; }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // ── Selection on active change AFTER mount ──
  useEffect(() => {
    if (!hasMounted.current) return;
    if (active) {
      selectProgress.value = 0;
      selectProgress.value = withTiming(1, { duration: 800, easing: EASE_DECELERATE });
      // Glow burst
      glowVal.value = 0;
      glowVal.value = withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(0.4, { duration: 500, easing: Easing.out(Easing.cubic) })
      );
      // 3D tilt pop
      tiltVal.value = 0;
      tiltVal.value = withSequence(
        withTiming(1, { duration: 200, easing: EASE_DECELERATE }),
        withTiming(0, { duration: 600, easing: EASE_STANDARD })
      );
    } else {
      selectProgress.value = withTiming(0, { duration: 300, easing: EASE_STANDARD });
      glowVal.value = withTiming(0, { duration: 300 });
      tiltVal.value = withTiming(0, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ── Stable press handlers ──
  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.88, { damping: 18, stiffness: 500 });
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 350 });
  }, [pressScale]);

  const handlePress = useCallback(() => {
    onClick?.(name);
    selectProgress.value = 0;
    selectProgress.value = withTiming(1, { duration: 800, easing: EASE_DECELERATE });
    glowVal.value = 0;
    glowVal.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
      withTiming(0.4, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    tiltVal.value = 0;
    tiltVal.value = withSequence(
      withTiming(1, { duration: 200, easing: EASE_DECELERATE }),
      withTiming(0, { duration: 600, easing: EASE_STANDARD })
    );
  }, [onClick, name, selectProgress, glowVal, tiltVal]);

  // ── Container style: entrance + tilt pop + press + idle ──
  const animatedStyle = useAnimatedStyle(() => {
    const e = entrance.value;
    const opacity = interpolate(e, [0, 1], [0, 1]);
    const scaleEnter = interpolate(e, [0, 0.7, 1], [0.5, 1.08, 1]);
    const translateY = interpolate(e, [0, 1], [16, 0]);

    // 3D tilt pop on selection
    const tilt = tiltVal.value;
    const rotateX = interpolate(tilt, [0, 1], [0, -15]);
    const rotateY = interpolate(tilt, [0, 1], [0, 8]);

    // Active scale boost
    const activeBoost = active ? 1.06 : 1;

    return {
      opacity,
      transform: [
        { perspective: 600 },
        { translateY },
        { rotateX: `${rotateX}deg` },
        { rotateY: `${rotateY}deg` },
        { scale: scaleEnter * pressScale.value * activeBoost },
      ],
    };
  });

  // ── Glow aura around active icon ──
  const glowStyle = useAnimatedStyle(() => {
    const base = active ? 0.35 : 0;
    const burst = glowVal.value * 0.5;
    return {
      opacity: base + burst,
      transform: [{ scale: 1 + glowVal.value * 0.2 }],
    };
  });

  if (!config || !activeBgColor) return null;

  return (
    <View
      className="items-center"
      style={{ gap: 8, paddingVertical: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label || name}
      accessibilityState={{ selected: active }}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={{ padding: 4 }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        {/* Glow aura layer (behind icon) */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              inset: -10,
              borderRadius: 28,
              backgroundColor: config.glowStrong,
              ...Platform.select({
                ios: { shadowColor: config.glowStrong, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 16 },
                android: { elevation: 0 },
              }),
            },
            glowStyle,
          ]}
        />

        <Animated.View
          className={`rounded-2xl items-center justify-center ${active ? activeBgColor : INACTIVE_BG}`}
          style={[
            { width: size, height: size },
            animatedStyle,
            // Claymorphic depth — multi-layer shadow effect
            {
              borderWidth: 1,
              borderColor: active ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
              ...Platform.select({
                ios: {
                  shadowColor: active ? config.solid : '#000',
                  shadowOffset: { width: 0, height: active ? 8 : 4 },
                  shadowOpacity: active ? 0.4 : 0.12,
                  shadowRadius: active ? 14 : 6,
                },
                android: { elevation: active ? 12 : 4 },
              }),
            },
          ]}
        >
          {/* Inner top highlight (claymorphism) */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 1, left: 1, right: 1,
              height: '40%',
              borderRadius: 14,
              backgroundColor: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)',
            }}
          />
          <CustomIcon name={name} active={active} selectProgress={selectProgress} idle={idle} />
        </Animated.View>
      </Pressable>

      {label && (
        <Text
          className={`text-[10px] tracking-tight ${
            active ? 'text-neutral-900 dark:text-neutral-50 font-semibold' : 'text-neutral-400 dark:text-neutral-500 font-medium'
          }`}
        >
          {label}
        </Text>
      )}
    </View>
  );
});

export default CategoryIcon;