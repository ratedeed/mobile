import React from 'react';
import { Image, View, Text, StyleSheet, ImageSourcePropType, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Radii, Colors } from '../../constants/designTokens';

export interface AvatarProps {
  source?: ImageSourcePropType;
  size?: number;
  style?: StyleProp<ViewStyle | ImageStyle>;
  text?: string;
  [key: string]: any;
}

const Avatar: React.FC<AvatarProps> = ({ source, size = 48, style, text, ...props }) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: Radii.round,
    backgroundColor: Colors.neutral300,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  };

  const textStyle = {
    fontSize: size * 0.4,
    color: Colors.neutral800,
    fontWeight: '600' as const,
  };

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.avatarImage, avatarStyle, style as StyleProp<ImageStyle>]}
        {...props}
      />
    );
  }

  if (text) {
    const initials = text.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    return (
      <View style={[styles.avatarPlaceholder, avatarStyle, style]} {...props}>
        <Text style={textStyle}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.avatarPlaceholder, avatarStyle, style]} {...props}>
      <Text style={textStyle}>?</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarImage: {
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
  },
});

export default Avatar;