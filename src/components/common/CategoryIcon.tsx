import React, { useEffect, memo, useMemo } from 'react';
import { View, Pressable, Text, Platform } from 'react-native';
import Svg, { Path, Rect, Circle, Ellipse, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withRepeat, 
  withSequence, 
  withTiming,
  withDelay,
  Easing,
  interpolate
} from 'react-native-reanimated';

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION  –  Colour, shadow, tilt & float per category
// ═══════════════════════════════════════════════════════════════════════

export const catGradients: Record<string, { from: string; to: string; mid: string; bg: string }> = {
  grid: { from: "#71717a", to: "#52525b", mid: "#a1a1aa", bg: 'bg-neutral-100 dark:bg-neutral-900' },
  home: { from: "#f59e0b", to: "#d97706", mid: "#fbbf24", bg: 'bg-amber-50 dark:bg-amber-950/40' },
  droplets: { from: "#0ea5e9", to: "#0284c7", mid: "#38bdf8", bg: 'bg-sky-50 dark:bg-sky-950/40' },
  zap: { from: "#eab308", to: "#f59e0b", mid: "#fde047", bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
  paintbrush: { from: "#8b5cf6", to: "#7c3aed", mid: "#a78bfa", bg: 'bg-violet-50 dark:bg-violet-950/40' },
  trees: { from: "#10b981", to: "#059669", mid: "#34d399", bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  wind: { from: "#06b6d4", to: "#0891b2", mid: "#22d3ee", bg: 'bg-cyan-50 dark:bg-cyan-950/40' },
  warehouse: { from: "#f97316", to: "#ea580c", mid: "#fb923c", bg: 'bg-orange-50 dark:bg-orange-950/40' },
  sparkles: { from: "#ec4899", to: "#db2777", mid: "#f472b6", bg: 'bg-pink-50 dark:bg-pink-950/40' },
  wrench: { from: "#64748b", to: "#475569", mid: "#94a3b8", bg: 'bg-slate-50 dark:bg-slate-950/40' },
  hammer: { from: "#92400e", to: "#78350f", mid: "#b45309", bg: 'bg-orange-50 dark:bg-orange-950/40' },
};

export const catActiveBg: Record<string, string> = {
  grid: "bg-neutral-800 dark:bg-neutral-200",
  home: "bg-amber-600",
  droplets: "bg-sky-600",
  zap: "bg-yellow-500",
  paintbrush: "bg-violet-600",
  trees: "bg-emerald-600",
  wind: "bg-cyan-600",
  warehouse: "bg-orange-600",
  sparkles: "bg-pink-600",
  wrench: "bg-slate-700",
  hammer: "bg-amber-800",
};

type Icon3D = {
  floatAmpY: number;
  floatSpeed: number;
};

const icon3D: Record<string, Icon3D> = {
  home:       { floatAmpY: 2.5, floatSpeed: 5000 },
  droplets:   { floatAmpY: 3,   floatSpeed: 4200 },
  hammer:     { floatAmpY: 2,   floatSpeed: 4800 },
  zap:        { floatAmpY: 3.5, floatSpeed: 3500 },
  trees:      { floatAmpY: 2,   floatSpeed: 5500 },
  wind:       { floatAmpY: 2,   floatSpeed: 3800 },
  sparkles:   { floatAmpY: 3,   floatSpeed: 4000 },
  wrench:     { floatAmpY: 2,   floatSpeed: 5000 },
  warehouse:  { floatAmpY: 1.5, floatSpeed: 6000 },
  paintbrush: { floatAmpY: 2.5, floatSpeed: 4500 },
  grid:       { floatAmpY: 2,   floatSpeed: 5200 },
};

// ═══════════════════════════════════════════════════════════════════════
// SVG ICON COMPONENT
// ═══════════════════════════════════════════════════════════════════════

function CustomIcon({ name, active }: { name: string; active: boolean }) {
  const g = catGradients[name];
  const fill = active ? "#ffffff" : `url(#grad-${name})`;
  
  const gradDef = useMemo(() => (!active && g ? (
    <Defs>
      <LinearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={g.from} />
        <Stop offset="45%" stopColor={g.mid} />
        <Stop offset="100%" stopColor={g.to} />
      </LinearGradient>
    </Defs>
  ) : null), [active, g, name]);

  const svgProps = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none" as const };

  switch (name) {
    case 'home':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Path d="M3 21V10h18v11H3z" fill={fill} opacity={0.35} />
          <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={fill} />
          <Rect x="9.5" y="13" width="5" height="4" rx="0.8" fill={active ? "#ffffffaa" : "#fbbf24"} />
          <Rect x="4" y="14" width="3.5" height="3.5" rx="0.5" fill={active ? "#ffffff88" : "#fcd34d"} />
          <Rect x="16.5" y="14" width="3.5" height="3.5" rx="0.5" fill={active ? "#ffffff88" : "#fcd34d"} />
        </Svg>
      );
    case 'droplets':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z" fill={fill} />
          <Ellipse cx="10" cy="13.5" rx="1.5" ry="2" fill={active ? "#ffffff55" : "#7dd3fc"} transform="rotate(-15 10 13.5)" />
          <Circle cx="14" cy="11" r="0.8" fill={active ? "#ffffff66" : "#bae6fd"} />
          <Circle cx="5" cy="20" r="1" fill={active ? "#ffffff44" : "#38bdf8"} />
          <Circle cx="18" cy="21" r="0.7" fill={active ? "#ffffff33" : "#7dd3fc"} />
        </Svg>
      );
    case 'zap':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Circle cx="12" cy="12" r="10" fill={active ? "#ffffff15" : "#fef08a"} opacity={0.4} />
          <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={fill} />
          <Path d="M10 9l3-1.5 1 3-3 1.5-1-3z" fill={active ? "#ffffff55" : "#fef08a"} />
        </Svg>
      );
    case 'grid':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
          <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
          <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
          <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        </Svg>
      );
    case 'paintbrush':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Path d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z" fill={fill} />
          <Rect x="3.5" y="14.5" width="7" height="2" rx="1" fill={active ? "#ffffff66" : "#c4b5fd"} transform="rotate(-30 7 15.5)" />
          <Circle cx="2" cy="19" r="0.8" fill={active ? "#ffffff44" : "#a78bfa"} />
          <Circle cx="5" cy="21" r="0.6" fill={active ? "#ffffff33" : "#c4b5fd"} />
          <Circle cx="8" cy="20" r="0.5" fill={active ? "#ffffff22" : "#ddd6fe"} />
        </Svg>
      );
    case 'trees':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Rect x="10.5" y="19" width="3" height="3" rx="0.5" fill={active ? "#ffffffaa" : "#a16207"} />
          <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={fill} />
          <Circle cx="9" cy="8" r="1.2" fill={active ? "#ffffff33" : "#6ee7b7"} />
          <Circle cx="15" cy="11" r="0.9" fill={active ? "#ffffff33" : "#6ee7b7"} />
        </Svg>
      );
    case 'wind':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Circle cx="12" cy="12" r="8" fill={fill} opacity={0.12} />
          <G transform="translate(0, 0)">
            <Circle cx="12" cy="5" r="1.2" fill={fill} />
            <Circle cx="19" cy="12" r="1.2" fill={fill} />
            <Circle cx="12" cy="19" r="1.2" fill={fill} />
            <Circle cx="5" cy="12" r="1.2" fill={fill} />
            <Path d="M12 5a7 7 0 017 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <Path d="M5 12a7 7 0 007 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <Path d="M19 12a7 7 0 01-7 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <Path d="M12 5a7 7 0 00-7 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </G>
          <Circle cx="12" cy="12" r="2.5" fill={fill} />
        </Svg>
      );
    case 'warehouse':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Path d="M3 21V9l9-7 9 7v12H3z" fill={fill} opacity={0.3} />
          <Path d="M2 10l10-8 10 8" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M4 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M20 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M4 10h16" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
          <Rect x="9" y="14" width="6" height="7" rx="0.5" fill={fill} />
        </Svg>
      );
    case 'sparkles':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Path d="M12 2l1.8 5.5L19.5 9l-5.5 1.8L12 16l-1.8-5.5L4.5 9l5.5-1.8L12 2z" fill={fill} />
          <Path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill={fill} />
          <Path d="M6 16l0.7 2.3 2.3.7-2.3.7L6 22l-0.7-2.3L3 19l2.3-.7L6 16z" fill={fill} />
        </Svg>
      );
    case 'wrench':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z" fill={fill} />
          <Circle cx="16.5" cy="7.5" r="1" fill={active ? "#ffffff55" : "#94a3b8"} />
        </Svg>
      );
    case 'hammer':
      return (
        <Svg {...svgProps}>
          {gradDef}
          <Path d="M10.5 10.5S8 11 6 13c-2 2-2.5 4.5-2.5 4.5l-1 4s2 0 4-1.5c2-1.5 3-4 3-4" stroke={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14.7 6.3l5.5 5.5c.8.8.8 2 0 2.8l-1.4 1.4c-.8.8-2 .8-2.8 0L10.5 10.5" stroke={fill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="11" y="3" width="8" height="6" rx="1.5" transform="rotate(45 15 6)" fill={fill} />
        </Svg>
      );
    default:
      return null;
  }
}

let categoryEntrancePlayed = false;

export const CategoryIcon = memo(function CategoryIcon({ 
  name, 
  active, 
  index = 0,
  size = 48,
  label,
  onClick 
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
  const progress = useSharedValue(0); // 0 to 1 for entrance
  const floatVal = useSharedValue(0); // for idle floating
  const pressScale = useSharedValue(1);

  // ── Entrance Animation (Matches Web's complex 3D pop) ──
  useEffect(() => {
    const delay = categoryEntrancePlayed ? 0 : index * 100;
    let timer: NodeJS.Timeout;

    if (categoryEntrancePlayed) {
      progress.value = 1;
    } else {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withSpring(1, { 
          damping: 12, 
          stiffness: 90,
          mass: 1 
        })
      );
      timer = setTimeout(() => {
        categoryEntrancePlayed = true;
      }, 2000);
    }

    // ── Start Idle Float after entrance ──
    const floatTimer = setTimeout(() => {
      floatVal.value = withRepeat(
        withSequence(
          withTiming(1, { duration: cfg3D.floatSpeed / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: cfg3D.floatSpeed / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, categoryEntrancePlayed ? 0 : delay + 1200);

    return () => {
      if (timer) clearTimeout(timer);
      clearTimeout(floatTimer);
    };
  }, [name, index, cfg3D.floatSpeed]);

  // ── Press Animation ──
  const handlePressIn = () => { pressScale.value = withSpring(0.92); };
  const handlePressOut = () => { pressScale.value = withSpring(1); };

  const animatedStyle = useAnimatedStyle(() => {
    // 1. Arrival/Entrance Interpolations
    const scale = interpolate(progress.value, [0, 0.5, 0.8, 1], [0.3, 0.6, 1.08, 1]);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0, 0.5, 1]);
    const rotateX = interpolate(progress.value, [0, 0.5, 1], [40, 20, 0]);
    const rotateY = interpolate(progress.value, [0, 0.5, 1], [-25, -12, 0]);
    const translateY_Entrance = interpolate(progress.value, [0, 1], [-20, 0]);

    // 2. Idle Float
    const floatY = interpolate(floatVal.value, [0, 1], [0, -cfg3D.floatAmpY]);

    return {
      opacity,
      transform: [
        { perspective: 800 },
        { translateY: translateY_Entrance + floatY },
        { rotateX: `${rotateX}deg` },
        { rotateY: `${rotateY}deg` },
        { scale: scale * pressScale.value * (active ? 1.08 : 1) },
      ],
    };
  });

  if (!config || !activeBgColor) return null;

  return (
    <View className="items-center" style={{ gap: 8, paddingVertical: 8 }}>
      <Pressable 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onClick?.(name)}
        style={({ pressed }) => [
          {
            // Sufficient padding to prevent clipping during animation
            padding: 4,
          }
        ]}
      >
        <Animated.View 
          className={`rounded-2xl items-center justify-center ${active ? activeBgColor : config.bg}`}
          style={[
            { width: size, height: size },
            animatedStyle,
            !active && {
              // Enhanced clay look for Mobile
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                },
                android: {
                  elevation: 4,
                },
              }),
            }
          ]}
        >
          <CustomIcon name={name} active={active} />
        </Animated.View>
      </Pressable>
      
      {label && (
        <Text className={`text-[10px] font-semibold tracking-tight ${
          active ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-500 dark:text-neutral-400'
        }`}>
          {label}
        </Text>
      )}
    </View>
  );
});

export default CategoryIcon;
