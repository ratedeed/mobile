import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/designTokens';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'verified' | 'premium';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  style,
}) => {
  const getVariantStyles = (): { bg: string; text: string } => {
    switch (variant) {
      case 'success':
        return { bg: Colors.success100, text: Colors.success700 };
      case 'warning':
        return { bg: Colors.warning100, text: Colors.warning700 };
      case 'error':
        return { bg: Colors.error100, text: Colors.error700 };
      case 'info':
        return { bg: Colors.primary100, text: Colors.primary700 };
      case 'verified':
        return { bg: Colors.success500, text: Colors.neutral50 };
      case 'premium':
        return { bg: Colors.warning500, text: Colors.neutral900 };
      default:
        return { bg: Colors.neutral200, text: Colors.neutral700 };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = size === 'sm' ? styles.sm : styles.md;

  return (
    <View
      style={[
        styles.badge,
        sizeStyles,
        { backgroundColor: variantStyles.bg },
        style,
      ]}
    >
      {variant === 'verified' && <Text style={styles.verifiedIcon}>✓</Text>}
      {variant === 'premium' && <Text style={styles.premiumIcon}>★</Text>}
      <Text style={[styles.text, { color: variantStyles.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedIcon: {
    color: Colors.neutral50,
    fontSize: 10,
    marginRight: 4,
  },
  premiumIcon: {
    color: Colors.neutral900,
    fontSize: 10,
    marginRight: 4,
  },
});
