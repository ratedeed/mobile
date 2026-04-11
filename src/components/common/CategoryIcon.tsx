import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Path, Rect, Circle, Ellipse, G, Defs, LinearGradient, Stop } from 'react-native-svg';

export const catGradients: Record<string, { from: string; to: string; bg: string }> = {
  grid:         { from: '#71717a', to: '#52525b', bg: 'bg-neutral-100 dark:bg-neutral-900' },
  home:         { from: '#f59e0b', to: '#d97706', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  droplets:     { from: '#0ea5e9', to: '#0284c7', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  zap:          { from: '#eae308', to: '#f4f009', bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
  paintbrush:   { from: '#8b5cf6', to: '#7c3aed', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  trees:        { from: '#10b981', to: '#059669', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  wind:         { from: '#06b6d4', to: '#0891b2', bg: 'bg-cyan-50 dark:bg-cyan-950/40' },
  warehouse:    { from: '#f97316', to: '#ea580c', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  sparkles:     { from: '#ec4899', to: '#db2777', bg: 'bg-pink-50 dark:bg-pink-950/40' },
  wrench:       { from: '#64748b', to: '#475569', bg: 'bg-slate-50 dark:bg-slate-950/40' },
  'cooking-pot':{ from: '#ef4444', to: '#dc2626', bg: 'bg-red-50 dark:bg-red-950/40' },
  bath:         { from: '#3b82f6', to: '#2563eb', bg: 'bg-blue-50 dark:bg-blue-950/40' },
};

export const catActiveBg: Record<string, string> = {
  grid:         'bg-neutral-800 dark:bg-neutral-200',
  home:         'bg-amber-600',
  droplets:     'bg-sky-600',
  zap:          'bg-yellow-500',
  paintbrush:   'bg-violet-600',
  trees:        'bg-emerald-600',
  wind:         'bg-cyan-600',
  warehouse:    'bg-orange-600',
  sparkles:     'bg-pink-600',
  wrench:       'bg-slate-700',
  'cooking-pot':'bg-red-600',
  bath:         'bg-blue-600',
};

function CustomIcon({ name, active }: { name: string; active: boolean }) {
  const g = catGradients[name];
  const fill = active ? '#ffffff' : `url(#grad-${name})`;
  const gradDef = !active && g ? (
    <Defs>
      <LinearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={g.from} />
        <Stop offset="100%" stopColor={g.to} />
      </LinearGradient>
    </Defs>
  ) : null;

  switch (name) {
    case 'grid':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Rect x="2" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
          <Rect x="13.5" y="2" width="8.5" height="8.5" rx="2.5" fill={fill} />
          <Rect x="2" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
          <Rect x="13.5" y="13.5" width="8.5" height="8.5" rx="2.5" fill={fill} />
        </Svg>
      );
    case 'home':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" fill={fill} />
          <Rect x="9.5" y="13" width="5" height="4" rx="0.8" fill={active ? '#ffffffaa' : '#fbbf24'} />
          <Rect x="4" y="14" width="3.5" height="3.5" rx="0.5" fill={active ? '#ffffff88' : '#fcd34d'} />
          <Rect x="16.5" y="14" width="3.5" height="3.5" rx="0.5" fill={active ? '#ffffff88' : '#fcd34d'} />
        </Svg>
      );
    case 'droplets':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 0013 0C18.5 10 12 2.5 12 2.5z" fill={fill} />
          <Ellipse cx="10" cy="13.5" rx="1.5" ry="2" fill={active ? '#ffffff55' : '#7dd3fc'} transform="rotate(-15 10 13.5)" />
          <Circle cx="14" cy="11" r="0.8" fill={active ? '#ffffff66' : '#bae6fd'} />
        </Svg>
      );
    case 'zap':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M13 2L4 14h6l-2 8 9-12h-6l2-8z" fill={fill} />
          <Path d="M10 9l3-1.5 1 3-3 1.5-1-3z" fill={active ? '#ffffff55' : '#fef08a'} />
        </Svg>
      );
    case 'paintbrush':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M18 3c-1-1-3 0-5 2l-2 2-6 1-1 3 4-1 2-1c-2 3-3 6-2 7 1 1 4 0 7-2l-1 2 3-1 1-6 2-2c2-2 3-4 2-5l-2 1z" fill={fill} />
          <Rect x="3.5" y="14.5" width="7" height="2" rx="1" fill={active ? '#ffffff66' : '#c4b5fd'} transform="rotate(-30 7 15.5)" />
        </Svg>
      );
    case 'trees':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M12 2L5 10h3l-3 5h4l-3 4h14l-3-4h4l-3-5h3L12 2z" fill={fill} />
          <Rect x="10.5" y="19" width="3" height="3" rx="0.5" fill={active ? '#ffffffaa' : '#a16207'} />
          <Circle cx="9" cy="8" r="1.2" fill={active ? '#ffffff33' : '#6ee7b7'} />
          <Circle cx="15" cy="11" r="0.9" fill={active ? '#ffffff33' : '#6ee7b7'} />
        </Svg>
      );
    case 'wind':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Circle cx="12" cy="5" r="1.2" fill={fill} />
          <Circle cx="19" cy="12" r="1.2" fill={fill} />
          <Circle cx="12" cy="19" r="1.2" fill={fill} />
          <Circle cx="5" cy="12" r="1.2" fill={fill} />
          <Path d="M12 5a7 7 0 017 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M5 12a7 7 0 007 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M19 12a7 7 0 01-7 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Path d="M12 5a7 7 0 00-7 7" stroke={fill} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Circle cx="12" cy="12" r="2.5" fill={fill} />
          <Circle cx="12" cy="12" r="8" fill={fill} opacity="0.12" />
        </Svg>
      );
    case 'warehouse':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M3 21V9l9-7 9 7v12H3z" fill={fill} opacity="0.3" />
          <Path d="M2 10l10-8 10 8" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M4 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M20 21V10" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
          <Path d="M4 10h16" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
          <Rect x="9" y="14" width="6" height="7" rx="0.5" fill={fill} />
        </Svg>
      );
    case 'sparkles':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M12 2l1.8 5.5L19.5 9l-5.5 1.8L12 16l-1.8-5.5L4.5 9l5.5-1.8L12 2z" fill={fill} />
          <Path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill={fill} />
          <Path d="M6 16l0.7 2.3 2.3.7-2.3.7L6 22l-0.7-2.3L3 19l2.3-.7L6 16z" fill={fill} />
        </Svg>
      );
    case 'wrench':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3-3A5 5 0 0113 15.6L7.4 21.2a1.8 1.8 0 01-2.6 0 1.8 1.8 0 010-2.6l5.6-5.6A5 5 0 0117.7 3.3l-3 3z" fill={fill} />
          <Circle cx="16.5" cy="7.5" r="1" fill={active ? '#ffffff55' : '#94a3b8'} />
        </Svg>
      );
    case 'cooking-pot':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Rect x="3" y="10" width="18" height="9" rx="2" fill={fill} />
          <Path d="M8 10V8a4 4 0 018 0v2" stroke={fill} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Rect x="6" y="7" width="1.5" height="3" rx="0.75" fill={fill} />
          <Rect x="16.5" y="7" width="1.5" height="3" rx="0.75" fill={fill} />
        </Svg>
      );
    case 'bath':
      return (
        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {gradDef}
          <Path d="M4 10h16v7a5 5 0 01-5 5H9a5 5 0 01-5-5v-7z" fill={fill} />
          <Path d="M4 13h16" stroke={active ? '#ffffff55' : '#93c5fd'} strokeWidth="1" />
          <Circle cx="7" cy="7" r="1.5" fill={active ? '#ffffff66' : '#93c5fd'} />
          <Circle cx="11" cy="5.5" r="1" fill={active ? '#ffffff55' : '#93c5fd'} />
          <Circle cx="9" cy="3" r="0.7" fill={active ? '#ffffff44' : '#bfdbfe'} />
          <Rect x="18" y="12" width="2.5" height="4" rx="1" fill={fill} />
        </Svg>
      );
    default:
      return null;
  }
}

export function CategoryIcon({ name, active, size = 48 }: { name: string; active: boolean; size?: number }) {
  const config = catGradients[name];
  const activeBgColor = catActiveBg[name];

  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (active) {
      Animated.spring(scaleValue, {
        toValue: 1.1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [active, scaleValue]);

  if (!config || !activeBgColor) {
    return (
      <Animated.View className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-900 items-center justify-center" style={{ transform: [{ scale: scaleValue }] }}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="1.5">
          <Path d="M12 12h.01" />
        </Svg>
      </Animated.View>
    );
  }

  return (
    <Animated.View className={`w-12 h-12 rounded-2xl items-center justify-center ${active ? activeBgColor : config.bg}`} style={{ transform: [{ scale: scaleValue }] }}>
      <CustomIcon name={name} active={active} />
    </Animated.View>
  );
}
