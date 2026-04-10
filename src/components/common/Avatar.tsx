import React from 'react';
import { Image, View, Text, ImageSourcePropType, StyleProp, ViewStyle, ImageStyle, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/designTokens';

export interface AvatarProps {
  source?: ImageSourcePropType;
  size?: number;
  style?: StyleProp<ViewStyle | ImageStyle>;
  text?: string;
  [key: string]: any;
}

const Avatar: React.FC<AvatarProps> = ({ source, size = 48, style, text, ...props }) => {
  const avatarSizeStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.base, avatarSizeStyle, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
        {...props}
      />
    );
  }

  if (text) {
    const initials = text.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    return (
      <View style={[styles.base, styles.placeholder, avatarSizeStyle, style as StyleProp<ViewStyle>]} {...props}>
        <Text 
          style={[styles.initials, { fontSize: size * 0.4 }]}
        >
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.base, styles.placeholder, avatarSizeStyle, style as StyleProp<ViewStyle>]} {...props}>
      <Text 
        style={[styles.initials, { fontSize: size * 0.4 }]}
      >
        ?
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: Colors.neutral200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.neutral500,
    fontWeight: '600',
  },
});

export default Avatar;
