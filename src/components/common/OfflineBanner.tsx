import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/designTokens';

interface OfflineBannerProps {
  isVisible: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isVisible }) => {
  const insets = useSafeAreaInsets();
  if (!isVisible) return null;

  // Fallback status bar height to prevent overlapping on startup or on devices where insets.top initially returns 0
  const defaultStatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 20;
  const topPadding = Math.max(insets.top, defaultStatusBarHeight) + 6;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <Text style={styles.text} numberOfLines={1}>No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.warning500,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  text: {
    color: Colors.neutral50,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
