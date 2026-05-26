import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
} from 'react-native';
import { Spacing, Radii, Colors, Shadows } from '../../constants/designTokens';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmit?: () => void;
  onClear?: () => void;
  showCancelButton?: boolean;
  onCancel?: () => void;
  filterIcon?: React.ReactNode;
  debounceMs?: number;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  value = '',
  onChangeText,
  onFocus,
  onBlur,
  onSubmit,
  onClear,
  showCancelButton = true,
  onCancel,
  filterIcon,
  debounceMs = 300,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const cancelAnimation = useRef(new Animated.Value(0)).current;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleFocus = () => {
    setIsFocused(true);
    if (showCancelButton) {
      Animated.timing(cancelAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (showCancelButton && !localValue) {
      Animated.timing(cancelAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
    onBlur?.();
  };

  const handleChangeText = useCallback((text: string) => {
    setLocalValue(text);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      onChangeText?.(text);
    }, debounceMs);
  }, [onChangeText, debounceMs]);

  const handleClear = () => {
    setLocalValue('');
    onChangeText?.('');
    onClear?.();
  };

  const handleCancel = () => {
    setLocalValue('');
    onChangeText?.('');
    setIsFocused(false);
    Animated.timing(cancelAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onCancel?.();
  };

  const handleSubmit = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onChangeText?.(localValue);
    onSubmit?.();
  };

  const cancelWidth = cancelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 70],
  });

  return (
    <View style={styles.container}>
      <View style={[styles.searchContainer, isFocused && styles.searchContainerFocused]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.neutral400}
          value={localValue}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {localValue.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
        {filterIcon && <View style={styles.filterIcon}>{filterIcon}</View>}
      </View>

      {showCancelButton && (
        <Animated.View style={[styles.cancelContainer, { width: cancelWidth }]}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    ...Shadows.xs,
  },
  searchContainerFocused: {
    backgroundColor: Colors.neutral50,
    borderWidth: 1,
    borderColor: Colors.primary500,
    ...Shadows.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral800,
    paddingVertical: 0,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  clearIcon: {
    fontSize: 14,
    color: Colors.neutral400,
  },
  filterIcon: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  cancelContainer: {
    overflow: 'hidden',
  },
  cancelText: {
    color: Colors.primary500,
    fontSize: 16,
    fontWeight: '500',
    paddingLeft: Spacing.md,
  },
});

export default SearchBar;