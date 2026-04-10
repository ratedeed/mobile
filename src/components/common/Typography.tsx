import React from 'react';
import { Text, TextProps, StyleProp, TextStyle, StyleSheet } from 'react-native';
import { Colors, FontSizes, FontWeights } from '../../constants/designTokens';

export interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body' | 'caption' | 'button' | 'label';
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

const Typography: React.FC<TypographyProps> = ({ variant = 'body', children, style, ...props }) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'h1': return styles.h1;
      case 'h2': return styles.h2;
      case 'h3': return styles.h3;
      case 'h4': return styles.h4;
      case 'h5': return styles.h5;
      case 'h6': return styles.h6;
      case 'subtitle1': return styles.subtitle1;
      case 'subtitle2': return styles.subtitle2;
      case 'body': return styles.body;
      case 'caption': return styles.caption;
      case 'button': return styles.button;
      case 'label': return styles.label;
      default: return styles.body;
    }
  };

  return (
    <Text 
      style={[getVariantStyle(), style]} 
      {...props}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold as any,
    color: Colors.neutral900,
    marginBottom: 16,
  },
  h2: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold as any,
    color: Colors.neutral900,
    marginBottom: 16,
  },
  h3: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold as any,
    color: Colors.neutral900,
    marginBottom: 8,
  },
  h4: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold as any,
    color: Colors.neutral900,
    marginBottom: 8,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral900,
    marginBottom: 4,
  },
  h6: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral900,
    marginBottom: 4,
  },
  subtitle1: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.neutral900,
  },
  subtitle2: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutral500,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutral900,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.neutral500,
  },
  button: {
    fontSize: 16,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral900,
  },
});

export default Typography;
