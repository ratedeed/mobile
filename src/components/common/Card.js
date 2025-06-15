// src/components/common/Card.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing, Radii, Colors, Shadows } from '../../constants/designTokens';

const Card = ({ children, style, ...props }) => {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    ...Shadows.sm, // Apply small shadow for elevation
    borderWidth: 1,
    borderColor: Colors.neutral100,
  },
});

export default Card;