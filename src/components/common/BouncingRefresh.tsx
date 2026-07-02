import React, { useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  FlatListProps,
  SectionListProps,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { BouncingDotsLoader } from './BouncingDotsLoader';
import { Colors } from '../../constants/designTokens';

const INDICATOR_HEIGHT = 64;
const THRESHOLD = 60;
const COLLAPSE_DURATION = 200;

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
  dotsWrap: {
    width: 60,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function clampHeight(raw: number, refreshing: boolean): number {
  if (refreshing) return INDICATOR_HEIGHT;
  if (raw <= 0) return 0;
  const damped = raw <= THRESHOLD ? raw : THRESHOLD + (raw - THRESHOLD) * 0.5;
  return Math.min(damped, 120);
}

function useIndicator(refreshing: boolean) {
  const indicatorRef = useRef<View | null>(null);
  const collapseRaf = useRef<number | null>(null);
  const isLockedRef = useRef(false);

  const apply = useCallback((height: number) => {
    const node = indicatorRef.current;
    if (!node) return;
    const opacity = Math.max(0, Math.min(1, height / INDICATOR_HEIGHT));
    (node as any).setNativeProps?.({ style: { height, opacity } });
  }, []);

  const lock = useCallback(() => {
    if (collapseRaf.current != null) {
      cancelAnimationFrame(collapseRaf.current);
      collapseRaf.current = null;
    }
    isLockedRef.current = true;
    apply(INDICATOR_HEIGHT);
  }, [apply]);

  const collapse = useCallback(() => {
    isLockedRef.current = false;
    if (collapseRaf.current != null) cancelAnimationFrame(collapseRaf.current);
    const start = Date.now();
    const fromHeight = INDICATOR_HEIGHT;
    const step = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / COLLAPSE_DURATION);
      const h = fromHeight * (1 - t);
      apply(h);
      if (t < 1) {
        collapseRaf.current = requestAnimationFrame(step);
      } else {
        apply(0);
        collapseRaf.current = null;
      }
    };
    collapseRaf.current = requestAnimationFrame(step);
  }, [apply]);

  useEffect(() => {
    if (refreshing) lock();
    else collapse();
    return () => {
      if (collapseRaf.current != null) {
        cancelAnimationFrame(collapseRaf.current);
        collapseRaf.current = null;
      }
    };
  }, [refreshing, lock, collapse]);

  return { indicatorRef, apply, isLockedRef };
}

interface FlatListWrapperProps<ItemT = any>
  extends FlatListProps<ItemT> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshFlatListInner<ItemT = any>(
  props: FlatListWrapperProps<ItemT>,
  ref: React.Ref<FlatList<ItemT>>,
) {
  const {
    refreshing,
    onRefresh,
    loaderColor,
    style,
    onScroll: userOnScroll,
    onScrollBeginDrag: userOnScrollBeginDrag,
    onScrollEndDrag: userOnScrollEndDrag,
    ...rest
  } = props;

  const { indicatorRef, apply, isLockedRef } = useIndicator(refreshing);
  const pullValueRef = useRef(0);
  const triggeredRef = useRef(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const next = clampHeight(-y, isLockedRef.current);
      if (Math.abs(next - pullValueRef.current) > 0.5) {
        pullValueRef.current = next;
        apply(next);
      }
      userOnScroll?.(e);
    },
    [apply, isLockedRef, userOnScroll],
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isLockedRef.current && !triggeredRef.current && pullValueRef.current >= THRESHOLD) {
        triggeredRef.current = true;
        onRefresh();
      } else if (!isLockedRef.current) {
        apply(0);
        pullValueRef.current = 0;
      }
      userOnScrollEndDrag?.(e);
    },
    [apply, isLockedRef, onRefresh, userOnScrollEndDrag],
  );

  useEffect(() => {
    if (!refreshing) triggeredRef.current = false;
  }, [refreshing]);

  return (
    <View style={[styles.container, style]}>
      <FlatList<ItemT>
        ref={ref}
        {...rest}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onScrollBeginDrag={userOnScrollBeginDrag}
        scrollEventThrottle={16}
      />
      <View ref={indicatorRef} pointerEvents="none" style={styles.indicator}>
        <View style={styles.dotsWrap}>
          <BouncingDotsLoader size="medium" color={loaderColor ?? Colors.primary500} />
        </View>
      </View>
    </View>
  );
}

interface ScrollViewWrapperProps extends React.ComponentProps<typeof ScrollView> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshScrollViewInner(
  props: ScrollViewWrapperProps,
  ref: React.Ref<ScrollView>,
) {
  const {
    refreshing,
    onRefresh,
    loaderColor,
    style,
    onScroll: userOnScroll,
    onScrollBeginDrag: userOnScrollBeginDrag,
    onScrollEndDrag: userOnScrollEndDrag,
    children,
    ...rest
  } = props;

  const { indicatorRef, apply, isLockedRef } = useIndicator(refreshing);
  const pullValueRef = useRef(0);
  const triggeredRef = useRef(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const next = clampHeight(-y, isLockedRef.current);
      if (Math.abs(next - pullValueRef.current) > 0.5) {
        pullValueRef.current = next;
        apply(next);
      }
      userOnScroll?.(e);
    },
    [apply, isLockedRef, userOnScroll],
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isLockedRef.current && !triggeredRef.current && pullValueRef.current >= THRESHOLD) {
        triggeredRef.current = true;
        onRefresh();
      } else if (!isLockedRef.current) {
        apply(0);
        pullValueRef.current = 0;
      }
      userOnScrollEndDrag?.(e);
    },
    [apply, isLockedRef, onRefresh, userOnScrollEndDrag],
  );

  useEffect(() => {
    if (!refreshing) triggeredRef.current = false;
  }, [refreshing]);

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={ref}
        {...rest}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onScrollBeginDrag={userOnScrollBeginDrag}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
      <View ref={indicatorRef} pointerEvents="none" style={styles.indicator}>
        <View style={styles.dotsWrap}>
          <BouncingDotsLoader size="medium" color={loaderColor ?? Colors.primary500} />
        </View>
      </View>
    </View>
  );
}

interface SectionListWrapperProps<ItemT = any, SectionT = any>
  extends SectionListProps<ItemT, SectionT> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshSectionListInner<ItemT = any, SectionT = any>(
  props: SectionListWrapperProps<ItemT, SectionT>,
  ref: React.Ref<SectionList<ItemT, SectionT>>,
) {
  const {
    refreshing,
    onRefresh,
    loaderColor,
    style,
    onScroll: userOnScroll,
    onScrollBeginDrag: userOnScrollBeginDrag,
    onScrollEndDrag: userOnScrollEndDrag,
    ...rest
  } = props;

  const { indicatorRef, apply, isLockedRef } = useIndicator(refreshing);
  const pullValueRef = useRef(0);
  const triggeredRef = useRef(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const next = clampHeight(-y, isLockedRef.current);
      if (Math.abs(next - pullValueRef.current) > 0.5) {
        pullValueRef.current = next;
        apply(next);
      }
      userOnScroll?.(e);
    },
    [apply, isLockedRef, userOnScroll],
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isLockedRef.current && !triggeredRef.current && pullValueRef.current >= THRESHOLD) {
        triggeredRef.current = true;
        onRefresh();
      } else if (!isLockedRef.current) {
        apply(0);
        pullValueRef.current = 0;
      }
      userOnScrollEndDrag?.(e);
    },
    [apply, isLockedRef, onRefresh, userOnScrollEndDrag],
  );

  useEffect(() => {
    if (!refreshing) triggeredRef.current = false;
  }, [refreshing]);

  return (
    <View style={[styles.container, style]}>
      <SectionList<ItemT, SectionT>
        ref={ref}
        {...rest}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onScrollBeginDrag={userOnScrollBeginDrag}
        scrollEventThrottle={16}
      />
      <View ref={indicatorRef} pointerEvents="none" style={styles.indicator}>
        <View style={styles.dotsWrap}>
          <BouncingDotsLoader size="medium" color={loaderColor ?? Colors.primary500} />
        </View>
      </View>
    </View>
  );
}

const BouncingRefreshFlatList = React.forwardRef(BouncingRefreshFlatListInner) as <ItemT = any>(
  p: FlatListWrapperProps<ItemT> & { ref?: React.Ref<FlatList<ItemT>> },
) => React.ReactElement;

const BouncingRefreshScrollView = React.forwardRef(BouncingRefreshScrollViewInner);

const BouncingRefreshSectionList = React.forwardRef(BouncingRefreshSectionListInner) as <
  ItemT = any,
  SectionT = any,
>(
  p: SectionListWrapperProps<ItemT, SectionT> & {
    ref?: React.Ref<SectionList<ItemT, SectionT>>;
  },
) => React.ReactElement;

export {
  BouncingRefreshFlatList,
  BouncingRefreshScrollView,
  BouncingRefreshSectionList,
};
