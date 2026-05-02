import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

type VerifiedBadgeVariant = 'glass' | 'solid' | 'outline';

interface VerifiedBadgeProps {
  variant?: VerifiedBadgeVariant;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

const SIZE_CONFIG = {
  sm: { icon: 8, fontSize: 8, px: 6, py: 2, gap: 3, letterSpacing: 0.5 },
  md: { icon: 11, fontSize: 10, px: 10, py: 4, gap: 4, letterSpacing: 0.8 },
  lg: { icon: 13, fontSize: 11, px: 12, py: 5, gap: 5, letterSpacing: 1 },
};

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  variant = 'glass',
  text = 'Verified',
  size = 'md',
  style,
}) => {
  const s = SIZE_CONFIG[size];

  const containerStyle = [
    styles.base,
    {
      paddingHorizontal: s.px,
      paddingVertical: s.py,
      gap: s.gap,
    },
    variant === 'glass' && styles.glass,
    variant === 'solid' && styles.solid,
    variant === 'outline' && styles.outline,
    style,
  ];

  // Ratedeed indigo brand with gold check accent
  const iconColor = variant === 'solid' ? '#fbbf24' : '#4F46E5';
  const textColor =
    variant === 'solid'
      ? '#ffffff'
      : variant === 'outline'
      ? '#4F46E5'
      : '#4338CA';

  return (
    <View style={containerStyle}>
      <FontAwesome5 name="check-decagram" size={s.icon} color={iconColor} solid />
      <Text
        style={{
          fontSize: s.fontSize,
          fontWeight: '800',
          color: textColor,
          letterSpacing: s.letterSpacing,
          textTransform: 'uppercase',
        }}
      >
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  solid: {
    backgroundColor: '#4F46E5',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  outline: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
});

export default VerifiedBadge;
