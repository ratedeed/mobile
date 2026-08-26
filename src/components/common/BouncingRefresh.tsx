import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  FlatListProps,
  SectionListProps,
  useColorScheme,
} from 'react-native';
import { BouncingDotsLoader } from './BouncingDotsLoader';

const styles = StyleSheet.create({
  container: { flex: 1 },
  indicatorContainer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  dotsWrapper: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface CommonProps {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function makeRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      colors={['transparent']}
      progressBackgroundColor="transparent"
      style={{ backgroundColor: 'transparent' }}
    />
  );
}

const BouncingRefreshIndicator: React.FC<{
  refreshing: boolean;
  loaderColor?: string;
}> = ({ refreshing, loaderColor }) => {
  const anim = useRef(new Animated.Value(refreshing ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: refreshing ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: false,
    }).start();
  }, [refreshing, anim]);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 48],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Animated.View style={[styles.indicatorContainer, { height, opacity }]}>
      <View style={styles.dotsWrapper}>
        <BouncingDotsLoader size="small" color={loaderColor || '#4F46E5'} />
      </View>
    </Animated.View>
  );
};

interface BouncingRefreshFlatListProps<ItemT = any>
  extends Omit<FlatListProps<ItemT>, 'refreshControl'> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshFlatListInner<ItemT = any>(
  props: BouncingRefreshFlatListProps<ItemT>,
  ref: React.Ref<FlatList<ItemT>>,
) {
  const { refreshing, onRefresh, loaderColor, style, ...rest } = props;
  const isDark = useColorScheme() === 'dark';
  const effectiveColor = loaderColor || (isDark ? '#818CF8' : '#4F46E5');

  return (
    <View style={[styles.container, style]}>
      <BouncingRefreshIndicator refreshing={refreshing} loaderColor={effectiveColor} />
      <FlatList<ItemT>
        ref={ref}
        {...(rest as FlatListProps<ItemT>)}
        refreshControl={makeRefreshControl(refreshing, onRefresh)}
      />
    </View>
  );
}

interface BouncingRefreshScrollViewProps
  extends Omit<React.ComponentProps<typeof ScrollView>, 'refreshControl'> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshScrollViewInner(
  props: BouncingRefreshScrollViewProps,
  ref: React.Ref<ScrollView>,
) {
  const { refreshing, onRefresh, loaderColor, style, children, ...rest } = props;
  const isDark = useColorScheme() === 'dark';
  const effectiveColor = loaderColor || (isDark ? '#818CF8' : '#4F46E5');

  return (
    <View style={[styles.container, style]}>
      <BouncingRefreshIndicator refreshing={refreshing} loaderColor={effectiveColor} />
      <ScrollView
        ref={ref}
        {...(rest as React.ComponentProps<typeof ScrollView>)}
        refreshControl={makeRefreshControl(refreshing, onRefresh)}
      >
        {children}
      </ScrollView>
    </View>
  );
}

interface BouncingRefreshSectionListProps<ItemT = any, SectionT = any>
  extends Omit<SectionListProps<ItemT, SectionT>, 'refreshControl'> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshSectionListInner<ItemT = any, SectionT = any>(
  props: BouncingRefreshSectionListProps<ItemT, SectionT>,
  ref: React.Ref<SectionList<ItemT, SectionT>>,
) {
  const { refreshing, onRefresh, loaderColor, style, ...rest } = props;
  const isDark = useColorScheme() === 'dark';
  const effectiveColor = loaderColor || (isDark ? '#818CF8' : '#4F46E5');

  return (
    <View style={[styles.container, style]}>
      <BouncingRefreshIndicator refreshing={refreshing} loaderColor={effectiveColor} />
      <SectionList<ItemT, SectionT>
        ref={ref}
        {...(rest as SectionListProps<ItemT, SectionT>)}
        refreshControl={makeRefreshControl(refreshing, onRefresh)}
      />
    </View>
  );
}

const BouncingRefreshFlatList = React.forwardRef(BouncingRefreshFlatListInner) as <ItemT = any>(
  p: BouncingRefreshFlatListProps<ItemT> & { ref?: React.Ref<FlatList<ItemT>> },
) => React.ReactElement;

const BouncingRefreshScrollView = React.forwardRef(BouncingRefreshScrollViewInner);

const BouncingRefreshSectionList = React.forwardRef(BouncingRefreshSectionListInner) as <
  ItemT = any,
  SectionT = any,
>(
  p: BouncingRefreshSectionListProps<ItemT, SectionT> & {
    ref?: React.Ref<SectionList<ItemT, SectionT>>;
  },
) => React.ReactElement;

export {
  BouncingRefreshFlatList,
  BouncingRefreshScrollView,
  BouncingRefreshSectionList,
};
