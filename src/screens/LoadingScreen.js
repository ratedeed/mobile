import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../constants/designTokens'; // Assuming designTokens are available

const LoadingScreen = () => {
  useEffect(() => {
    console.log('LoadingScreen mounted.');
    return () => {
      console.log('LoadingScreen unmounted.');
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary500} />
      <Text style={styles.loadingText}>Loading...</Text>
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
    fontSize: 18,
    color: Colors.neutral700,
  },
});

export default LoadingScreen;