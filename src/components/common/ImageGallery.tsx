import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
} from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/designTokens';

interface ImageGalleryProps {
  images: string[];
  height?: number;
  onImagePress?: (index: number) => void;
  showPagination?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  height = 250,
  onImagePress,
  showPagination = true,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const slideWidth = SCREEN_WIDTH;
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / slideWidth);
    setActiveIndex(index);
  };

  const goToImage = (index: number) => {
    scrollRef.current?.scrollTo({
      x: index * SCREEN_WIDTH,
      animated: true,
    });
    setActiveIndex(index);
    onImagePress?.(index);
  };

  if (images.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderIcon}>🖼️</Text>
        <Text style={styles.placeholderText}>No images available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {images.map((uri, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.9}
            onPress={() => onImagePress?.(index)}
          >
            <Image
              source={{ uri }}
              style={[styles.image, { width: SCREEN_WIDTH, height }]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showPagination && images.length > 1 && (
        <View style={styles.pagination}>
          <View style={styles.paginationDots}>
            {images.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => goToImage(index)}
              >
                <View
                  style={[
                    styles.dot,
                    index === activeIndex && styles.dotActive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {activeIndex + 1} / {images.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: Colors.neutral100,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.neutral500,
  },
  pagination: {
    position: 'absolute',
    bottom: Spacing.md,
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    backgroundColor: Colors.neutral50,
    width: 18,
  },
  counter: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radii.sm,
  },
  counterText: {
    fontSize: 12,
    color: Colors.neutral50,
    fontWeight: '500',
  },
});

export default ImageGallery;