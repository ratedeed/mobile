import React, { useEffect, memo } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';

export interface FreeDiagnosticCardProps {
  type?: 'free' | 'virtual_only' | 'service_fee' | 'none';
  feeAmount?: number;
  feeWaivedIfHired?: boolean;
  notes?: string;
  delayMs?: number;
}

export const FreeDiagnosticCard = memo(function FreeDiagnosticCard({
  type = 'free',
  feeAmount,
  feeWaivedIfHired = true,
  notes,
  delayMs = 1400, // Arrive smoothly 1-2s after loading contractor profile
}: FreeDiagnosticCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isVirtual = type === 'virtual_only';
  const isServiceFee = type === 'service_fee' && feeAmount && feeAmount > 0;

  // Primary bold text
  const boldText = isVirtual
    ? 'Free virtual diagnosis'
    : isServiceFee
      ? feeWaivedIfHired
        ? `$${feeAmount} Diagnostic fee`
        : `$${feeAmount} Diagnostic fee`
      : 'Free diagnosis';

  // Subtitle text
  const subtitleText = notes
    ? notes
    : isVirtual
      ? 'Up to 100% free photo & video estimate'
      : isServiceFee && feeWaivedIfHired
        ? '100% credited toward your repair if hired'
        : 'No-obligation consultation & quote';

  // Shared animation values running on the UI thread for locked 120 FPS
  const cardProgress = useSharedValue(0);
  const textProgress = useSharedValue(0);
  const iconProgress = useSharedValue(0);
  const iconRotate = useSharedValue(0);
  const iconScale = useSharedValue(0.86);

  useEffect(() => {
    // 1. Smooth card expansion & arrival after 1.4s
    cardProgress.value = withDelay(
      delayMs,
      withTiming(1, {
        duration: 650,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
    );

    // 2. Text smoothly reveals on the left
    textProgress.value = withDelay(
      delayMs + 180,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      })
    );

    // 3. Small delay (~340ms pause), then original subtle calendar tap plays on the right
    iconProgress.value = withDelay(
      delayMs + 520,
      withTiming(1, { duration: 250 })
    );

    iconRotate.value = withDelay(
      delayMs + 520,
      withSequence(
        withTiming(-24, { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
        withTiming(10, { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
        withTiming(-4, { duration: 250 }),
        withTiming(0, { duration: 250 })
      )
    );

    iconScale.value = withDelay(
      delayMs + 520,
      withSequence(
        withTiming(1.16, { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
        withTiming(1.05, { duration: 280 }),
        withTiming(1.0, { duration: 500 })
      )
    );
  }, [delayMs, cardProgress, textProgress, iconProgress, iconRotate, iconScale]);

  // Card container animated style (expand height & slide in)
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const maxHeight = interpolate(cardProgress.value, [0, 1], [0, 90]);
    const marginTop = interpolate(cardProgress.value, [0, 1], [0, 12]);
    const marginBottom = interpolate(cardProgress.value, [0, 1], [0, 8]);
    const opacity = interpolate(cardProgress.value, [0, 0.3, 1], [0, 0.4, 1]);
    const translateY = interpolate(cardProgress.value, [0, 1], [-12, 0]);
    const scale = interpolate(cardProgress.value, [0, 1], [0.97, 1]);

    return {
      maxHeight,
      marginTop,
      marginBottom,
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Text animated style
  const textAnimatedStyle = useAnimatedStyle(() => {
    const opacity = textProgress.value;
    const translateY = interpolate(textProgress.value, [0, 1], [4, 0]);
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // Calendar icon animated style (original subtle tap)
  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: iconProgress.value,
      transform: [
        { rotate: `${iconRotate.value}deg` },
        { scale: iconScale.value },
      ],
    };
  });

  return (
    <Animated.View style={[styles.outerWrapper, containerAnimatedStyle]}>
      <View
        style={[
          styles.card,
          isDark ? styles.cardDark : styles.cardLight,
        ]}
      >
        {/* Specular glass top highlight */}
        <View
          style={[
            styles.glassHighlight,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)' },
          ]}
        />

        {/* Text Container with Left-to-Right Stagger */}
        <Animated.View style={[styles.textWrapper, textAnimatedStyle]}>
          <Text style={styles.textLine} numberOfLines={1}>
            <Text style={[styles.boldLabel, isDark ? styles.boldLabelDark : styles.boldLabelLight]}>
              {boldText}
            </Text>
            <Text style={[styles.subtitle, isDark ? styles.subtitleDark : styles.subtitleLight]}>
              {' '}· {subtitleText}
            </Text>
          </Text>
        </Animated.View>

        {/* Calendar Icon */}
        <Animated.View style={[styles.iconWrapper, iconAnimatedStyle]}>
          <Feather
            name="calendar"
            size={18}
            color={isDark ? '#E5E5E5' : '#1C1B1F'}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
});

export default FreeDiagnosticCard;

const styles = StyleSheet.create({
  outerWrapper: {
    overflow: 'visible',
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#1C1B1F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 1,
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
  },
  textWrapper: {
    flex: 1,
    paddingRight: 10,
  },
  textLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  boldLabel: {
    fontWeight: '700',
  },
  boldLabelLight: {
    color: '#059669',
  },
  boldLabelDark: {
    color: '#34D399',
  },
  subtitle: {
    fontWeight: '400',
  },
  subtitleLight: {
    color: '#717171',
  },
  subtitleDark: {
    color: '#A3A3A3',
  },
  iconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
