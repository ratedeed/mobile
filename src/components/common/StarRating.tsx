import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  useColorScheme,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
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
  const isDark = useColorScheme() === 'dark';

  const renderStar = (index: number) => {
    const starNumber = index + 1;
    const isFilled = starNumber <= Math.floor(rating);
    const isHalf = starNumber === Math.ceil(rating) && rating % 1 !== 0;

    let iconName: 'star' | 'star-half-o' | 'star-o' = 'star-o';
    if (isFilled) {
      iconName = 'star';
    } else if (isHalf) {
      iconName = 'star-half-o';
    }

    const starColor = isFilled || isHalf 
      ? Colors.warning500 
      : (isDark ? Colors.neutral700 : Colors.neutral300);

    const star = (
      <FontAwesome name={iconName} size={size} color={starColor} />
    );

    if (interactive && onRatingChange) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => onRatingChange(starNumber)}
          style={styles.starButton}
          activeOpacity={0.7}
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
        <Text 
          style={[
            styles.label, 
            { 
              fontSize: size * 0.7,
              color: isDark ? Colors.neutral300 : Colors.neutral600 
            }
          ]}
        >
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
  label: {
    marginLeft: Spacing.sm,
    fontWeight: '500',
  },
});

export default StarRating;