'use client';

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppHeaderProps {
  showBack?: boolean;
  showLogo?: boolean;
  showSearch?: boolean;
  showMenu?: boolean;
  showBell?: boolean;
  title?: string;
  transparent?: boolean;
}

export function AppHeader({
  showBack = false,
  showLogo = true,
  showSearch = false,
  showMenu = true,
  showBell = true,
  title,
  transparent = false,
}: AppHeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Poll for notification updates
    function updateCount() {
      AsyncStorage.getItem('unreadNotifications').then((value) => {
        const count = value ? parseInt(value, 10) : 0;
        setUnreadCount(count);
      }).catch(() => {});
    }
    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleNavigateHome = () => {
    navigation.navigate('Home' as never);
  };

  const handleNavigateSearch = () => {
    navigation.navigate('Search' as never);
  };

  const handleToggleNotifications = () => {
    // Dispatch event for notification panel toggle - components can listen to this
    // In React Native, we'd typically use a global event emitter or context
  };

  const displayCount = unreadCount > 9 ? '9+' : unreadCount.toString();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top > 0 ? insets.top : 8 },
        transparent ? styles.transparent : styles.solid,
      ]}
    >
      {/* Left */}
      <View style={styles.leftContainer}>
        {showBack && (
          <TouchableOpacity
            onPress={handleGoBack}
            style={styles.iconButton}
            accessibilityLabel="Go back"
          >
            <FontAwesome5 name="chevron-left" size={20} color="#374151" />
          </TouchableOpacity>
        )}
        {showLogo && !showBack && (
          <TouchableOpacity onPress={handleNavigateHome} style={styles.logoContainer}>
            <FontAwesome5 name="hammer" size={22} color="#4F46E5" />
            <Text style={styles.logoText}>ratedeed</Text>
          </TouchableOpacity>
        )}
        {title && (
          <Text style={styles.title}>{title}</Text>
        )}
      </View>

      {/* Right */}
      <View style={styles.rightContainer}>
        {showSearch && (
          <TouchableOpacity
            onPress={handleNavigateSearch}
            style={styles.searchButton}
          >
            <FontAwesome5 name="search" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
        {showBell && (
          <TouchableOpacity
            onPress={handleToggleNotifications}
            style={styles.bellButton}
            accessibilityLabel="Notifications"
          >
            <FontAwesome5 name="bell" size={16} color="#374151" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{displayCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {showMenu && (
          <TouchableOpacity style={styles.menuButton}>
            <FontAwesome5 name="bars" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  solid: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#4F46E5',
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  searchButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bellButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    padding: 10,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    backgroundColor: '#F43F5E',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  menuButton: {
    backgroundColor: '#111827',
    borderRadius: 999,
    padding: 10,
  },
});
