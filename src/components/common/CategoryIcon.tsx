import React, { useEffect, memo, useCallback } from 'react';
import { View, Pressable, Text, Platform } from 'react-native';
import Svg, { Path, Rect, Circle, Ellipse, G, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
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
  useDerivedValue,
} from 'react-native-reanimated';

// ═══════════════════════════════════════════════════════════════════════
// ANIMATED PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ═══════════════════════════════════════════════════════════════════════
// PREMIUM EASING (Material / Airbnb-inspired)
// ═══════════════════════════════════════════════════════════════════════

// Standard material easing — smooth, not bouncy
const EASE_STANDARD = Easing.bezier(0.4, 0, 0.2, 1);
const EASE_DECELERATE = Easing.bezier(0, 0, 0.2, 1);
const EASE_ACCELERATE = Easing.bezier(0.4, 0, 1, 1);

const SVG_PROPS = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' as const };

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION — refined, premium palette
// ═══════════════════════════════════════════════════════════════════════

export const catGradients: Record<
  string,
  { from: string; to: string; mid: string; solid: string }
> = {
  grid:       { from: '#71717a', to: '#3f3f46', mid: '#a1a1aa', solid: '#52525b' },
  home:       { from: '#f59e0b', to: '#b45309', mid: '#fbbf24', solid: '#d97706' },
  droplets:   { from: '#0ea5e9', to: '#0369a1', mid: '#38bdf8', solid: '#0284c7' },
  zap:        { from: '#eab308', to: '#a16207', mid: '#fde047', solid: '#ca8a04' },
  paintbrush: { from: '#8b5cf6', to: '#6d28d9', mid: '#a78bfa', solid: '#7c3aed' },
  trees:      { from: '#10b981', to: '#047857', mid: '#34d399', solid: '#059669' },
  wind:       { from: '#06b6d4', to: '#0e7490', mid: '#22d3ee', solid: '#0891b2' },
  warehouse:  { from: '#f97316', to: '#c2410c', mid: '#fb923c', solid: '#ea580c' },
  sparkles:   { from: '#ec4899', to: '#be185d', mid: '#f472b6', solid: '#db2777' },
  wrench:     { from: '#64748b', to: '#334155', mid: '#94a3b8', solid: '#475569' },
  hammer:     { from: '#92400e', to: '#78350f', mid: '#b45309', solid: '#92400e' },
};

// Active = solid bold color. Inactive = clean neutral.
export const catActiveBg: Record<string, string> = {
  grid: 'bg-neutral-800 dark:bg-neutral-100',
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

// Inactive = consistent neutral, NOT colored — premium, calm
const INACTIVE_BG = 'bg-neutral-100 dark:bg-neutral-800';

// Subtle float — barely perceptible, slow, smooth
type FloatConfig = { amp: number; speed: number; phase: number };
const floatConfig: Record<string, FloatConfig> = {
  home:       { amp: 1.5, speed: 6000, phase: 0 },
  droplets:   { amp: 1.8, speed: 5500, phase: 0.5 },
  hammer:     { amp: 1.2, speed: 6500, phase: 1.0 },
  zap:        { amp: 1.8, speed: 5000, phase: 1.5 },
  trees:      { amp: 1.2, speed: 6500, phase: 2.0 },
  wind:       { amp: 1.5, speed: 5500, phase: 2.5 },
  sparkles:   { amp: 1.8, speed: 5200, phase: 3.0 },
  wrench:     { amp: 1.2, speed: 6200, phase: 3.5 },
  warehouse:  { amp: 1.0, speed: 6800, phase: 4.0 },
  paintbrush: { amp: 1.5, speed: 5800, phase: 4.5 },
  grid:       { amp: 1.2, speed: 6300, phase: 5.0 },
};

// ═══════════════════════════════════════════════════════════════════════
// SHARED GRADIENT DEF — memoized, stable
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
      <RadialGradient id={`shine-${name}`} cx="35%" cy="25%" r="60%">
        <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
        <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </RadialGradient>
    </Defs>
  );
});

// ═══════════════════════════════════════════════════════════════════════
// ICON COMPONENTS — each memoized, max 1 animated prop, cheap
// ═══════════════════════════════════════════════════════════════════════

type IconProps = {
  active: boolean;
  selectProgress: SharedValue<number>;
  name: string;
  g: { from: string; to: string; mid: string };
};

// ── HOME ──
const HomeIcon = memo(function HomeIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Single subtle scale pulse on selection — that's it
  const bodyProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = 1 + 0.08 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 14 }, { scale }, { translateX: -12 }, { translateY: -14 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={bodyProps}>
        <Path d="M3 21V10h18v11H3z" fill={fill} opacity={0.4} />
        <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={fill} />
        {!active && <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <Rect x="10.5" y="14" width="3" height="5" rx="0.8" fill={active ? '#ffffff' : '#fcd34d'} opacity={0.9} />
      <Rect x="4.5" y="14.5" width="3" height="3" rx="0.5" fill={active ? '#ffffff' : '#fde68a'} opacity={0.8} />
      <Rect x="16.5" y="14.5" width="3" height="3" rx="0.5" fill={active ? '#ffffff' : '#fde68a'} opacity={0.8} />
    </Svg>
  );
});

// ── DROPLETS ──
const DropletsIcon = memo(function DropletsIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const mainProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scaleY = 1 - 0.1 * pulse;
    const scaleX = 1 + 0.06 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 15 }, { scaleX }, { scaleY }, { translateX: -12 }, { translateY: -15 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={mainProps}>
        <Path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z" fill={fill} />
        {!active && <Path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <Ellipse cx="10" cy="13.5" rx="1.5" ry="2" fill={active ? '#ffffff80' : '#7dd3fc'} transform="rotate(-15 10 13.5)" />
      <Circle cx="5" cy="20" r="1" fill={active ? '#ffffff80' : '#38bdf8'} />
      <Circle cx="18" cy="21" r="0.7" fill={active ? '#ffffff60' : '#7dd3fc'} />
    </Svg>
  );
});

// ── ZAP ──
const ZapIcon = memo(function ZapIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const boltProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = 1 + 0.12 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 12 }, { scale }, { translateX: -12 }, { translateY: -12 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={boltProps}>
        <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={fill} />
        {!active && <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <Path d="M10 9l3-1.5 1 3-3 1.5-1-3z" fill={active ? '#ffffff80' : '#fef08a'} />
    </Svg>
  );
});

// ── GRID ──
const GridIcon = memo(function GridIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  // Single subtle unified pulse — no scatter (too noisy/laggy)
  const tilesProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = 1 + 0.06 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 12 }, { scale }, { translateX: -12 }, { translateY: -12 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={tilesProps}>
        <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
        <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
        <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
        <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        {!active && <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={`url(#shine-${name})`} />}
      </AnimatedG>
    </Svg>
  );
});

// ── PAINTBRUSH ──
const PaintbrushIcon = memo(function PaintbrushIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const brushProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const rot = 4 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 12 }, { rotate: `${rot}deg` }, { translateX: -12 }, { translateY: -12 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={brushProps}>
        <Path d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z" fill={fill} />
        {!active && <Path d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <Rect x="3.5" y="14.5" width="7" height="2" rx="1" fill={active ? '#ffffff80' : '#c4b5fd'} transform="rotate(-30 7 15.5)" />
      <Circle cx="2" cy="19" r="0.8" fill={active ? '#ffffff60' : '#a78bfa'} />
      <Circle cx="5" cy="21" r="0.6" fill={active ? '#ffffff40' : '#c4b5fd'} />
    </Svg>
  );
});

// ── TREES ──
const TreesIcon = memo(function TreesIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const treeProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = 1 + 0.08 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 12 }, { scale }, { translateX: -12 }, { translateY: -12 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <Rect x="10.5" y="19" width="3" height="3" rx="0.5" fill={active ? '#ffffff' : '#a16207'} />
      <AnimatedG animatedProps={treeProps}>
        <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={fill} />
        {!active && <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <Circle cx="9" cy="8" r="1.2" fill={active ? '#ffffff60' : '#6ee7b7'} />
      <Circle cx="15" cy="11" r="0.9" fill={active ? '#ffffff60' : '#6ee7b7'} />
    </Svg>
  );
});

// ── WIND ──
const WindIcon = memo(function WindIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const spinProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const rotation = s * 180;
    return {
      transform: [
        { translateX: 12 }, { translateY: 12 }, { rotate: `${rotation}deg` }, { translateX: -12 }, { translateY: -12 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={spinProps}>
        <Circle cx="12" cy="5" r="1.2" fill={fill} />
        <Circle cx="19" cy="12" r="1.2" fill={fill} />
        <Circle cx="12" cy="19" r="1.2" fill={fill} />
        <Circle cx="5" cy="12" r="1.2" fill={fill} />
        <Path d="M12 5a7 7 0 017 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <Path d="M5 12a7 7 0 007 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <Path d="M19 12a7 7 0 01-7 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <Path d="M12 5a7 7 0 00-7 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </AnimatedG>
      <Circle cx="12" cy="12" r="2.5" fill={fill} />
    </Svg>
  );
});

// ── WAREHOUSE ──
const WarehouseIcon = memo(function WarehouseIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const buildingProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = 1 + 0.06 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 14 }, { scale }, { translateX: -12 }, { translateY: -14 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={buildingProps}>
        <Path d="M3 21V9l9-7 9 7v12H3z" fill={fill} opacity={0.3} />
        <Path d="M2 10l10-8 10 8" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M4 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M20 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M4 10h16" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
        <Rect x="9" y="14" width="6" height="7" rx="0.5" fill={fill} />
      </AnimatedG>
    </Svg>
  );
});

// ── SPARKLES ──
const SparklesIcon = memo(function SparklesIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const starsProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const scale = 1 + 0.1 * pulse;
    const rot = 30 * pulse;
    return {
      transform: [
        { translateX: 12 }, { translateY: 12 }, { scale }, { rotate: `${rot}deg` }, { translateX: -12 }, { translateY: -12 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={starsProps}>
        <Path d="M12 2l1.8 5.5L19.5 9l-5.5 1.8L12 16l-1.8-5.5L4.5 9l5.5-1.8L12 2z" fill={fill} />
        {!active && <Path d="M12 2l1.8 5.5L19.5 9l-5.5 1.8L12 16l-1.8-5.5L4.5 9l5.5-1.8L12 2z" fill={`url(#shine-${name})`} />}
        <Path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill={fill} />
        <Path d="M6 16l0.7 2.3 2.3.7-2.3.7L6 22l-0.7-2.3L3 19l2.3-.7L6 16z" fill={fill} />
      </AnimatedG>
    </Svg>
  );
});

// ── WRENCH ──
const WrenchIcon = memo(function WrenchIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const tightenProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const rot = 25 * pulse;
    return {
      transform: [
        { translateX: 17 }, { translateY: 7 }, { rotate: `${rot}deg` }, { translateX: -17 }, { translateY: -7 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={tightenProps}>
        <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z" fill={fill} />
        {!active && <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z" fill={`url(#shine-${name})`} />}
      </AnimatedG>
      <Circle cx="16.5" cy="7.5" r="1" fill={active ? '#ffffff80' : '#94a3b8'} />
    </Svg>
  );
});

// ── HAMMER ──
const HammerIcon = memo(function HammerIcon({ active, selectProgress, name, g }: IconProps) {
  const fill = active ? '#ffffff' : `url(#grad-${name})`;

  const swingProps = useAnimatedProps(() => {
    const s = selectProgress.value;
    const pulse = Math.sin(s * Math.PI);
    const rot = 15 * pulse;
    return {
      transform: [
        { translateX: 4 }, { translateY: 20 }, { rotate: `${rot}deg` }, { translateX: -4 }, { translateY: -20 },
      ],
    };
  });

  return (
    <Svg {...SVG_PROPS}>
      <GradientDef name={name} g={g} />
      <AnimatedG animatedProps={swingProps}>
        <Path d="M10.5 10.5S8 11 6 13c-2 2-2.5 4.5-2.5 4.5l-1 4s2 0 4-1.5c2-1.5 3-4 3-4" stroke={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14.7 6.3l5.5 5.5c.8.8.8 2 0 2.8l-1.4 1.4c-.8.8-2 .8-2.8 0L10.5 10.5" stroke={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="11" y="3" width="8" height="6" rx="1.5" transform="rotate(45 15 6)" fill={fill} />
        {!active && <Rect x="11" y="3" width="8" height="6" rx="1.5" transform="rotate(45 15 6)" fill={`url(#shine-${name})`} />}
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

// Memoized icon dispatcher — stable, cached
const CustomIcon = memo(function CustomIcon({
  name,
  active,
  selectProgress,
}: {
  name: string;
  active: boolean;
  selectProgress: SharedValue<number>;
}) {
  const g = catGradients[name];
  const IconComp = ICON_COMPONENTS[name];
  if (!IconComp || !g) return null;
  return <IconComp name={name} active={active} selectProgress={selectProgress} g={g} />;
});

// ═══════════════════════════════════════════════════════════════════════
// MAIN CATEGORY ICON — premium, smooth, cached
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
  const cfg = floatConfig[name] || floatConfig.grid;

  // ── Animation Values ──
  const entrance = useSharedValue(0);
  const floatVal = useSharedValue(cfg.phase);
  const pressScale = useSharedValue(1);
  const selectProgress = useSharedValue(0);
  const hasMounted = useSharedValue(0);

  // ── SINGLE entrance on mount — no cascade, no re-trigger ──
  useEffect(() => {
    entrance.value = 0;
    entrance.value = withDelay(
      index * 50,
      withTiming(1, { duration: 350, easing: EASE_DECELERATE })
    );
    hasMounted.value = 1;

    // Float starts once, smoothly, after entrance
    floatVal.value = withDelay(
      400 + index * 50,
      withRepeat(
        withSequence(
          withTiming(1 + cfg.phase, { duration: cfg.speed / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0 + cfg.phase, { duration: cfg.speed / 2, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // ── Selection ONLY on active change AFTER mount — never on first render ──
  useEffect(() => {
    if (!hasMounted.value) return;
    if (active) {
      selectProgress.value = 0;
      selectProgress.value = withTiming(1, { duration: 300, easing: EASE_STANDARD });
    } else {
      selectProgress.value = withTiming(0, { duration: 200, easing: EASE_STANDARD });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ── Stable press handlers (cached) ──
  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.9, { damping: 18, stiffness: 500 });
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 16, stiffness: 400 });
  }, [pressScale]);

  const handlePress = useCallback(() => {
    onClick?.(name);
    // Quick selection pulse — 300ms, smooth, not laggy
    selectProgress.value = 0;
    selectProgress.value = withTiming(1, { duration: 300, easing: EASE_STANDARD });
  }, [onClick, name, selectProgress]);

  // ── Container style — entrance + subtle float + press ──
  const animatedStyle = useAnimatedStyle(() => {
    // Entrance: simple fade + rise, no 3D tilt (premium = restraint)
    const opacity = interpolate(entrance.value, [0, 1], [0, 1]);
    const translateY = interpolate(entrance.value, [0, 1], [12, 0]);
    const scale = interpolate(entrance.value, [0, 1], [0.85, 1]);

    // Float: subtle Y only, smooth sine
    const floatPhase = floatVal.value - cfg.phase;
    const floatY = interpolate(floatPhase, [0, 1], [0, -cfg.amp]);

    return {
      opacity,
      transform: [
        { translateY: translateY + floatY },
        { scale: scale * pressScale.value * (active ? 1.05 : 1) },
      ],
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
        <Animated.View
          className={`rounded-2xl items-center justify-center ${active ? activeBgColor : INACTIVE_BG}`}
          style={[
            { width: size, height: size },
            animatedStyle,
            {
              borderWidth: 1,
              borderColor: active ? 'transparent' : 'rgba(0,0,0,0.04)',
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: active ? 6 : 2 },
                  shadowOpacity: active ? 0.18 : 0.06,
                  shadowRadius: active ? 12 : 4,
                },
                android: { elevation: active ? 8 : 2 },
              }),
            },
          ]}
        >
          <CustomIcon name={name} active={active} selectProgress={selectProgress} />
        </Animated.View>
      </Pressable>

      {label && (
        <Text
          className={`text-[10px] font-medium tracking-tight ${
            active
              ? 'text-neutral-900 dark:text-neutral-50'
              : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          {label}
        </Text>
      )}
    </View>
  );
});

export default CategoryIcon;