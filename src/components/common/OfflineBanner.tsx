import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/designTokens';

interface OfflineBannerProps {
  isVisible: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isVisible }) => {
  const insets = useSafeAreaInsets();
  if (!isVisible) return null;

  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <Text style={styles.text} numberOfLines={1}>No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.warning500,
    paddingTop: 8,
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
