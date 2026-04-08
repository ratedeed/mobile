import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/designTokens';

interface LazyImageProps {
  uri: string;
  style?: object;
  placeholderSource?: number;
  blurRadius?: number;
  aspectRatio?: number;
  borderRadius?: number;
  onPress?: () => void;
  showRetry?: boolean;
}

const LazyImage: React.FC<LazyImageProps> = ({
  uri,
  style,
  placeholderSource,
  blurRadius = 10,
  aspectRatio,
  borderRadius = Radii.md,
  onPress,
  showRetry = true,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleLoad = () => {
    setLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleError = () => {
    setError(true);
  };

  const handleRetry = () => {
    setError(false);
    setLoaded(false);
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.container, { aspectRatio }, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {placeholderSource && !loaded && !error && (
        <View style={[styles.placeholder, { borderRadius }]}>
          <ActivityIndicator color={Colors.neutral400} />
        </View>
      )}

      {error ? (
        <View style={[styles.errorContainer, { borderRadius }]}>
          <Text style={styles.errorIcon}>🖼️</Text>
          {showRetry && (
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <Animated.View style={[styles.imageContainer, { borderRadius, opacity: fadeAnim }]}>
          <Image
            source={{ uri }}
            style={[styles.image, { borderRadius }]}
            onLoad={handleLoad}
            onError={handleError}
            resizeMode="cover"
          />
        </Animated.View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.neutral100,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  retryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.neutral200,
    borderRadius: Radii.sm,
  },
  retryText: {
    fontSize: 12,
    color: Colors.neutral600,
    fontWeight: '500',
  },
});

export default LazyImage;