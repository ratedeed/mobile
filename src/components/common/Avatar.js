// src/components/common/Avatar.js
import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { Radii, Colors } from '../../constants/designTokens';

const Avatar = ({ source, size = 48, style, text, ...props }) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: Radii.round,
    backgroundColor: Colors.neutral300, // Default background for text avatar
    justifyContent: 'center',
    alignItems: 'center',
  };

  const textStyle = {
    fontSize: size * 0.4, // Scale font size with avatar size
    color: Colors.neutral800,
    fontWeight: '600',
  };

  if (source) {
    return (
      <Image
        source={source}
        style={[styles.avatarImage, avatarStyle, style]}
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
      {/* Default fallback icon or empty state */}
      <Text style={textStyle}>?</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarImage: {
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    // Styles defined inline in avatarStyle
  },
});

export default Avatar;