import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Colors, Spacing } from '../../constants/designTokens';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showLabel?: boolean;
  style?: ViewStyle;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  size = 20,
  interactive = false,
  onRatingChange,
  showLabel = false,
  style,
}) => {
  const renderStar = (index: number) => {
    const starNumber = index + 1;
    const isFilled = starNumber <= Math.floor(rating);
    const isHalf = starNumber === Math.ceil(rating) && rating % 1 !== 0;

    const starChar = isHalf ? '½' : '★';

    const starColor = isFilled || isHalf ? Colors.warning500 : Colors.neutral300;

    const star = (
      <Text style={[styles.star, { fontSize: size, color: starColor }]}>
        {starChar}
      </Text>
    );

    if (interactive && onRatingChange) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => onRatingChange(starNumber)}
          style={styles.starButton}
        >
          {star}
        </TouchableOpacity>
      );
    }

    return (
      <View key={index} style={styles.starButton}>
        {star}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.starsContainer}>
        {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
      </View>
      {showLabel && (
        <Text style={[styles.label, { fontSize: size * 0.7 }]}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  starButton: {
    marginRight: 2,
  },
  star: {
    fontWeight: '400',
  },
  label: {
    marginLeft: Spacing.sm,
    color: Colors.neutral600,
    fontWeight: '500',
  },
});

export default StarRating;