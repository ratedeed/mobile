import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Animated,
  PanResponder,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Spacing } from '../constants/designTokens';

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  visible,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  
  const pan = useRef(new Animated.ValueXY()).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setScale(1);
      scaleValue.setValue(1);
      pan.setValue({ x: 0, y: 0 });
      pan.setOffset({ x: 0, y: 0 });
    }
  }, [visible, initialIndex, pan, scaleValue]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.8) {
          onClose();
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      const newScale = scale === 1 ? 2 : 1;
      Animated.spring(scaleValue, {
        toValue: newScale,
        useNativeDriver: true,
      }).start();
      setScale(newScale);
    }
    lastTap.current = now;
  };

  if (!visible || images.length === 0) return null;

  const uri = images[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Close button - top right */}
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose} 
          activeOpacity={0.7}
          accessibilityLabel="Close lightbox"
          accessibilityRole="button"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Main image area */}
        <Animated.View
          style={[
            styles.imageContainer,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale: scaleValue },
              ],
            },
          ]}
          {...panResponder.panHandlers}
          accessibilityRole="image"
          accessibilityLabel={`Image ${currentIndex + 1} of ${images.length}`}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDoubleTap}
            style={styles.imageWrapper}
          >
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Pagination dots for multiple images */}
        {images.length > 1 && (
          <View style={styles.pagination}>
            <View style={styles.paginationDots}>
              {images.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentIndex(index)}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                  accessibilityLabel={`View image ${index + 1}`}
                  accessibilityRole="button"
                >
                  <View
                    style={[
                      styles.dot,
                      index === currentIndex && styles.dotActive,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
    marginTop: -2,
  },
  pagination: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  paginationDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  counter: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
});

export default ImageLightbox;
