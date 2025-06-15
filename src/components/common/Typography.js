// src/components/common/Typography.js
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../../constants/designTokens';

const baseTextStyle = {
  fontFamily: 'System', // Use system font as default, or load custom fonts
  color: Colors.neutral800,
  lineHeight: 1.4 * 16, // Default line height for body text (1.4 * base font size)
};

const Typography = ({ variant = 'body', children, style, ...props }) => {
  const getTextStyle = () => {
    switch (variant) {
      case 'h1':
        return styles.h1;
      case 'h2':
        return styles.h2;
      case 'h3':
        return styles.h3;
      case 'h4':
        return styles.h4;
      case 'h5':
        return styles.h5;
      case 'h6':
        return styles.h6;
      case 'subtitle1':
        return styles.subtitle1;
      case 'subtitle2':
        return styles.subtitle2;
      case 'body':
        return styles.body;
      case 'caption':
        return styles.caption;
      case 'button':
        return styles.button;
      case 'label':
        return styles.label;
      default:
        return styles.body;
    }
  };

  return (
    <Text style={[baseTextStyle, getTextStyle(), style]} {...props}>
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -0.5,
    color: Colors.neutral900,
    marginBottom: Spacing.md,
  },
  h2: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.4,
    color: Colors.neutral900,
    marginBottom: Spacing.md,
  },
  h3: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.3,
    color: Colors.neutral900,
    marginBottom: Spacing.sm,
  },
  h4: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.2,
    color: Colors.neutral800,
    marginBottom: Spacing.sm,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    letterSpacing: -0.1,
    color: Colors.neutral800,
    marginBottom: Spacing.xs,
  },
  h6: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: 0,
    color: Colors.neutral800,
    marginBottom: Spacing.xs,
  },
  subtitle1: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 26,
    color: Colors.neutral700,
  },
  subtitle2: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: Colors.neutral600,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: Colors.neutral800,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: Colors.neutral500,
  },
  button: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral700,
  },
});

export default Typography;