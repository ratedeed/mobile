import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../constants/designTokens';
import Typography from '../components/common/Typography';

const LoadingScreen = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary500} />
      <Typography variant="body" style={styles.loadingText}>Loading...</Typography>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.neutral700,
  },
});

export default LoadingScreen;
