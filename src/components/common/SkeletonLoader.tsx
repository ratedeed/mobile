import React from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Colors } from '../../constants/designTokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.neutral300,
          opacity: opacity as any,
        },
        style,
      ]}
    />
  );
};

interface SkeletonLoaderProps {
  type?: 'card' | 'list' | 'profile' | 'post' | 'text' | 'notification' | 'messageBubble' | 'conversationRow';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'card',
  count = 1,
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'conversationRow':
        return (
          <View style={styles.conversationRow}>
            <Skeleton width={54} height={54} borderRadius={27} />
            <View style={styles.listContent}>
              <Skeleton width="45%" height={14} style={styles.mb8} />
              <Skeleton width="75%" height={12} />
            </View>
          </View>
        );

      case 'messageBubble':
        return (
          <View style={styles.messageBubbleContainer}>
            <View style={styles.messageBubbleLeftContainer}>
              <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 8 }} />
              <View style={[styles.messageBubble, styles.messageBubbleLeft]}>
                <Skeleton width={140} height={14} style={styles.mb8} />
                <Skeleton width={90} height={12} />
              </View>
            </View>
            <View style={styles.messageBubbleRightContainer}>
              <View style={[styles.messageBubble, styles.messageBubbleRight]}>
                <Skeleton width={160} height={14} style={styles.mb8} />
                <Skeleton width={110} height={12} />
              </View>
            </View>
          </View>
        );

      case 'card':
        return (
          <View style={styles.card}>
            <Skeleton width={60} height={60} borderRadius={30} />
            <View style={styles.cardContent}>
              <Skeleton width="60%" height={16} style={styles.mb8} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width="100%" height={120} borderRadius={8} style={styles.mt8} />
          </View>
        );

      case 'list':
        return (
          <View style={styles.listItem}>
            <Skeleton width={50} height={50} borderRadius={25} />
            <View style={styles.listContent}>
              <Skeleton width="50%" height={14} style={styles.mb8} />
              <Skeleton width="70%" height={12} />
            </View>
          </View>
        );

      case 'profile':
        return (
          <View style={styles.profile}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton width="50%" height={18} style={styles.mt16} />
            <Skeleton width="30%" height={14} style={styles.mt8} />
            <Skeleton width="100%" height={150} borderRadius={8} style={styles.mt16} />
          </View>
        );

      case 'post':
        return (
          <View style={styles.post}>
            <View style={styles.postHeader}>
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={styles.postHeaderText}>
                <Skeleton width={120} height={14} style={styles.mb4} />
                <Skeleton width={80} height={10} />
              </View>
            </View>
            <Skeleton width="100%" height={100} borderRadius={8} style={styles.mt12} />
            <View style={styles.postActions}>
              <Skeleton width={60} height={20} />
              <Skeleton width={60} height={20} />
            </View>
          </View>
        );

      case 'notification':
        return (
          <View style={styles.notification}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <View style={styles.notificationContent}>
              <Skeleton width="70%" height={14} style={styles.mb8} />
              <Skeleton width="45%" height={10} />
            </View>
          </View>
        );

      case 'text':
      default:
        return (
          <View>
            <Skeleton width="100%" height={14} style={styles.mb8} />
            <Skeleton width="95%" height={14} style={styles.mb8} />
            <Skeleton width="80%" height={14} />
          </View>
        );
    }
  };

  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <React.Fragment key={index}>{renderSkeleton()}</React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.neutral50,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardContent: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.neutral50,
    borderRadius: 8,
    marginBottom: 8,
  },
  listContent: {
    marginLeft: 12,
    flex: 1,
  },
  profile: {
    alignItems: 'center',
    padding: 20,
  },
  post: {
    backgroundColor: Colors.neutral50,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postHeaderText: {
    marginLeft: 12,
  },
  postActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  mb4: {
    marginBottom: 4,
  },
  mb8: {
    marginBottom: 8,
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },
  mt16: {
    marginTop: 16,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.neutral50,
    borderRadius: 12,
    marginBottom: 8,
  },
  notificationContent: {
    marginLeft: 12,
    flex: 1,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Colors.neutral50,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageBubbleContainer: {
    paddingVertical: 8,
    width: '100%',
  },
  messageBubbleLeftContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    width: '100%',
  },
  messageBubbleRightContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
    width: '100%',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '75%',
  },
  messageBubbleLeft: {
    backgroundColor: Colors.neutral100,
    borderTopLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: Colors.neutral200,
    borderTopRightRadius: 4,
  },
});
