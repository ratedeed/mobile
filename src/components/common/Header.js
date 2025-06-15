import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Colors, Shadows } from '../../constants/designTokens';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';

const Header = ({ title, showBackButton = false, onBackPress, rightComponent }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
      {showBackButton && (
        <TouchableOpacity onPress={onBackPress || (() => navigation.goBack())} style={styles.backButton}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.neutral50} />
        </TouchableOpacity>
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      {rightComponent && <View style={styles.rightComponent}>{rightComponent}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary500,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg, // Apply large shadow for layered depth
    zIndex: 10, // Ensure header is above other content
  },
  backButton: {
    position: 'absolute',
    left: Spacing.lg,
    // Top will be handled by safeAreaInsets
    padding: Spacing.xs,
  },
  headerTitle: {
    color: Colors.neutral50,
    fontSize: 22, // Consider defining font sizes in designTokens
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    flex: 1, // Allow title to take available space
  },
  rightComponent: {
    position: 'absolute',
    right: Spacing.lg,
    // Top will be handled by safeAreaInsets
  },
});

export default Header;