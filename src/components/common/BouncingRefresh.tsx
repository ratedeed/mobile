import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  FlatList,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  FlatListProps,
  SectionListProps,
} from 'react-native';
import { BouncingDotsLoader } from './BouncingDotsLoader';
import { Colors } from '../../constants/designTokens';

const INDICATOR_HEIGHT = 64;
const THRESHOLD = 60;

const styles = StyleSheet.create({
  container: { flex: 1 },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});

interface CommonProps {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function usePullState(refreshing: boolean, onRefresh: () => void) {
  const pull = useRef(new Animated.Value(0)).current;
  const pullValue = useRef(0);
  const canTrigger = useRef(true);

  const onUserScroll = useCallback(
    (y: number, userHandler?: (e: any) => void, e?: any) => {
      if (refreshing) {
        if (pullValue.current !== INDICATOR_HEIGHT) {
          pullValue.current = INDICATOR_HEIGHT;
          pull.setValue(INDICATOR_HEIGHT);
        }
      } else if (y < 0) {
        const raw = -y;
        const damped = raw <= THRESHOLD ? raw : THRESHOLD + (raw - THRESHOLD) * 0.5;
        const clamped = Math.min(damped, 120);
        if (Math.abs(clamped - pullValue.current) > 0.5) {
          pullValue.current = clamped;
          pull.setValue(clamped);
        }
      } else {
        if (pullValue.current !== 0) {
          pullValue.current = 0;
          pull.setValue(0);
        }
      }
      userHandler?.(e);
    },
    [refreshing, pull],
  );

  const onUserScrollEndDrag = useCallback(
    (userHandler?: (e: any) => void, e?: any) => {
      if (refreshing) {
        userHandler?.(e);
        return;
      }
      if (canTrigger.current && pullValue.current >= THRESHOLD) {
        onRefresh();
      } else {
        Animated.spring(pull, {
          toValue: 0,
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();
        pullValue.current = 0;
      }
      userHandler?.(e);
    },
    [refreshing, onRefresh, pull],
  );

  useEffect(() => {
    if (refreshing) {
      Animated.timing(pull, {
        toValue: INDICATOR_HEIGHT,
        duration: 200,
        useNativeDriver: false,
      }).start();
      pullValue.current = INDICATOR_HEIGHT;
      canTrigger.current = false;
    } else {
      Animated.timing(pull, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
      pullValue.current = 0;
      canTrigger.current = true;
    }
  }, [refreshing, pull]);

  const opacity = pull.interpolate({
    inputRange: [0, INDICATOR_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return { pull, opacity, onUserScroll, onUserScrollEndDrag };
}

interface BouncingRefreshFlatListProps<ItemT = any>
  extends Omit<FlatListProps<ItemT>, 'refreshControl' | 'style'> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshFlatListInner<ItemT = any>(
  props: BouncingRefreshFlatListProps<ItemT>,
  ref: React.Ref<FlatList<ItemT>>,
) {
  const {
    refreshing,
    onRefresh,
    loaderColor,
    style,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    ...rest
  } = props;

  const { pull, opacity, onUserScroll, onUserScrollEndDrag } = usePullState(
    refreshing,
    onRefresh,
  );

  const handleScroll = useCallback(
    (e: any) => onUserScroll(e.nativeEvent.contentOffset.y, onScroll, e),
    [onUserScroll, onScroll],
  );

  const handleScrollEndDrag = useCallback(
    (e: any) => onUserScrollEndDrag(onScrollEndDrag, e),
    [onUserScrollEndDrag, onScrollEndDrag],
  );

  const handleScrollBeginDrag = useCallback(
    (e: any) => onScrollBeginDrag?.(e),
    [onScrollBeginDrag],
  );

  return (
    <View style={[styles.container, style]}>
      <FlatList<ItemT>
        ref={ref}
        {...(rest as FlatListProps<ItemT>)}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { height: pull, opacity }]}
      >
        <BouncingDotsLoader size="medium" color={loaderColor ?? Colors.primary500} />
      </Animated.View>
    </View>
  );
}

interface BouncingRefreshScrollViewProps
  extends Omit<React.ComponentProps<typeof ScrollView>, 'refreshControl' | 'style'> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshScrollViewInner(
  props: BouncingRefreshScrollViewProps,
  ref: React.Ref<ScrollView>,
) {
  const {
    refreshing,
    onRefresh,
    loaderColor,
    style,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    children,
    ...rest
  } = props;

  const { pull, opacity, onUserScroll, onUserScrollEndDrag } = usePullState(
    refreshing,
    onRefresh,
  );

  const handleScroll = useCallback(
    (e: any) => onUserScroll(e.nativeEvent.contentOffset.y, onScroll, e),
    [onUserScroll, onScroll],
  );

  const handleScrollEndDrag = useCallback(
    (e: any) => onUserScrollEndDrag(onScrollEndDrag, e),
    [onUserScrollEndDrag, onScrollEndDrag],
  );

  const handleScrollBeginDrag = useCallback(
    (e: any) => onScrollBeginDrag?.(e),
    [onScrollBeginDrag],
  );

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={ref}
        {...(rest as React.ComponentProps<typeof ScrollView>)}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { height: pull, opacity }]}
      >
        <BouncingDotsLoader size="medium" color={loaderColor ?? Colors.primary500} />
      </Animated.View>
    </View>
  );
}

interface BouncingRefreshSectionListProps<ItemT = any, SectionT = any>
  extends Omit<SectionListProps<ItemT, SectionT>, 'refreshControl' | 'style'> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshSectionListInner<ItemT = any, SectionT = any>(
  props: BouncingRefreshSectionListProps<ItemT, SectionT>,
  ref: React.Ref<SectionList<ItemT, SectionT>>,
) {
  const {
    refreshing,
    onRefresh,
    loaderColor,
    style,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    ...rest
  } = props;

  const { pull, opacity, onUserScroll, onUserScrollEndDrag } = usePullState(
    refreshing,
    onRefresh,
  );

  const handleScroll = useCallback(
    (e: any) => onUserScroll(e.nativeEvent.contentOffset.y, onScroll, e),
    [onUserScroll, onScroll],
  );

  const handleScrollEndDrag = useCallback(
    (e: any) => onUserScrollEndDrag(onScrollEndDrag, e),
    [onUserScrollEndDrag, onScrollEndDrag],
  );

  const handleScrollBeginDrag = useCallback(
    (e: any) => onScrollBeginDrag?.(e),
    [onScrollBeginDrag],
  );

  return (
    <View style={[styles.container, style]}>
      <SectionList<ItemT, SectionT>
        ref={ref}
        {...(rest as SectionListProps<ItemT, SectionT>)}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { height: pull, opacity }]}
      >
        <BouncingDotsLoader size="medium" color={loaderColor ?? Colors.primary500} />
      </Animated.View>
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
