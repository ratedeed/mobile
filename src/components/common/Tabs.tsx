import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, ViewStyle } from 'react-native';
import { Colors } from '../../constants/designTokens';

interface TabItem {
  key: string;
  label: string;
  badge?: number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  style?: ViewStyle;
  variant?: 'default' | 'pills' | 'underline';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  style,
  variant = 'default',
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  if (variant === 'pills') {
    return (
      <View style={[styles.pillsContainer, style]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.pillTab,
              activeTab === tab.key && styles.pillTabActive,
            ]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text
              style={[
                styles.pillTabText,
                activeTab === tab.key && styles.pillTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.badge && tab.badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => onTabChange(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.badge && tab.badge > 0 && (
              <View style={[styles.badge, styles.badgeSmall]}>
                <Text style={[styles.badgeText, styles.badgeTextSmall]}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </Text>
              </View>
            )}
            {activeTab === tab.key && <View style={styles.indicator} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

interface TabPanelProps {
  children: React.ReactNode;
  isActive: boolean;
}

export const TabPanel: React.FC<TabPanelProps> = ({ children, isActive }) => {
  if (!isActive) return null;
  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.neutral50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral600,
  },
  tabTextActive: {
    color: Colors.primary600,
    fontWeight: '600',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: Colors.primary600,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  badge: {
    marginLeft: 6,
    backgroundColor: Colors.primary500,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeSmall: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.neutral50,
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextSmall: {
    fontSize: 9,
  },
  pillsContainer: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    backgroundColor: Colors.neutral50,
  },
  pillTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.neutral200,
  },
  pillTabActive: {
    backgroundColor: Colors.primary500,
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral700,
  },
  pillTabTextActive: {
    color: Colors.neutral50,
  },
});
