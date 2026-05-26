import React, { useRef, useState } from 'react';
import {
  RefreshControl,
  View,
  StyleSheet,
  Animated,
  Text,
  ViewStyle,
  ScrollView,
} from 'react-native';
import { Colors, Spacing } from '../../constants/designTokens';

interface PullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  tintColor?: string;
  title?: string;
  showFeedback?: boolean;
  successDuration?: number;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  refreshing,
  onRefresh,
  children,
  style,
  tintColor = Colors.primary500,
  title = 'Pull to refresh',
  showFeedback = true,
  successDuration = 1500,
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const handleRefresh = async () => {
    await onRefresh();
    
    if (showFeedback) {
      setShowSuccess(true);
      Animated.parallel([
        Animated.sequence([
          Animated.spring(successScale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 6,
            tension: 40,
          }),
          Animated.delay(successDuration - 600),
          Animated.timing(successScale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(successOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(successDuration - 400),
          Animated.timing(successOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => setShowSuccess(false));
    }
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tintColor}
            colors={[tintColor]}
            progressBackgroundColor={Colors.neutral50}
            title={!refreshing ? title : undefined}
          />
        }
      >
        {children}
      </ScrollView>
      
      {showFeedback && showSuccess && (
        <Animated.View
          style={[
            styles.successContainer,
            {
              transform: [{ scale: successScale }],
              opacity: successOpacity,
            },
          ]}
        >
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Updated!</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  successContainer: {
    position: 'absolute',
    top: Spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success500,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  successIcon: {
    color: Colors.neutral50,
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: Spacing.xs,
  },
  successText: {
    color: Colors.neutral50,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PullToRefresh;