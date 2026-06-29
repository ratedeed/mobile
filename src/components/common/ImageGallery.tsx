import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/designTokens';
import LazyImage from './LazyImage';

interface ImageGalleryProps {
  images: string[];
  height?: number;
  onImagePress?: (index: number) => void;
  showPagination?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  height = 250,
  onImagePress,
  showPagination = true,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const goToImage = (index: number) => {
    flatListRef.current?.scrollToIndex({
      index,
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
      <FlatList
        ref={flatListRef}
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, index) => index.toString()}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews={true}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onImagePress?.(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`View full screen image ${index + 1} of ${images.length}`}
          >
            <LazyImage
              uri={item}
              style={[styles.image, { width: SCREEN_WIDTH, height }]}
            />
          </TouchableOpacity>
        )}
      />

      {showPagination && images.length > 1 && (
        <View style={styles.pagination}>
          <View style={styles.paginationDots}>
            {images.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => goToImage(index)}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessibilityLabel={`Go to slide ${index + 1}`}
                accessibilityRole="button"
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