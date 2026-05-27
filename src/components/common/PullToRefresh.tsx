import React, { useRef, useState, useEffect } from 'react';
import {
  RefreshControl,
  View,
  StyleSheet,
  Animated,
  Text,
  ViewStyle,
  ScrollView,
  ScrollViewProps,
} from 'react-native';
import { Colors, Spacing } from '../../constants/designTokens';

interface PullToRefreshProps extends Omit<ScrollViewProps, 'refreshControl' | 'style'> {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  tintColor?: string;
  title?: string;
  showFeedback?: boolean;
  successDuration?: number;
  useScrollView?: boolean;
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
  useScrollView = true,
  ...scrollViewProps
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const prevRefreshing = useRef(refreshing);

  const triggerSuccessAnimation = () => {
    setShowSuccess(true);
    successScale.setValue(0);
    successOpacity.setValue(0);

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
  };

  useEffect(() => {
    if (prevRefreshing.current && !refreshing) {
      if (showFeedback) {
        triggerSuccessAnimation();
      }
    }
    prevRefreshing.current = refreshing;
  }, [refreshing, showFeedback]);

  const handleRefresh = () => {
    onRefresh();
  };

  return (
    <View style={[styles.container, style]}>
      {useScrollView ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
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
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
      
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    zIndex: 9999,
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