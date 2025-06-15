import React from 'react';
import { TextInput, StyleSheet, Text, View } from 'react-native';
import { Spacing, Radii, Colors, Shadows } from '../../constants/designTokens';

const Input = ({ label, style, ...props }) => {
  return (
    <View style={styles.inputGroup}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput style={[styles.input, style]} {...props} />
    </View>
  );
};

const styles = StyleSheet.create({
  inputGroup: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 15, // Consider defining font sizes in designTokens
    fontWeight: '600',
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  input: {
    width: '100%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neutral200,
    borderRadius: Radii.md,
    backgroundColor: Colors.neutral50,
    fontSize: 16, // Consider defining font sizes in designTokens
    color: Colors.neutral800,
    ...Shadows.xs, // Apply extra small shadow
  },
});

export default Input;