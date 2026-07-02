import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { BouncingDotsLoader } from './BouncingDotsLoader';
import { Colors } from '../../constants/designTokens';

const INDICATOR_HEIGHT = 64;
const COLLAPSE_DURATION = 200;

const HIDDEN = 'rgba(0, 0, 0, 0)';

const styles = StyleSheet.create({
  container: { flex: 1 },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 999,
  },
});

interface RefreshIndicatorProps {
  indicatorRef: React.RefObject<View | null>;
  color: string;
}

const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({ indicatorRef, color }) => (
  <View ref={indicatorRef} pointerEvents="none" style={styles.indicator}>
    <BouncingDotsLoader size="small" color={color} />
  </View>
);

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

function clampPull(raw: number): number {
  if (raw <= 0) return 0;
  return Math.min(raw, INDICATOR_HEIGHT * 1.5);
}

function makeRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={HIDDEN}
      colors={[HIDDEN]}
      progressBackgroundColor={HIDDEN}
      title=""
      titleColor={HIDDEN}
    />
  );
}

interface FlatListWrapperProps<ItemT = any>
  extends Omit<FlatListProps<ItemT>, 'refreshControl'> {
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
    ...rest
  } = props;

  const { indicatorRef, apply, isLockedRef } = useIndicator(refreshing);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isLockedRef.current) {
        const y = e.nativeEvent.contentOffset.y;
        const pull = clampPull(-y);
        apply(pull);
      }
      userOnScroll?.(e);
    },
    [apply, isLockedRef, userOnScroll],
  );

  return (
    <View style={[styles.container, style]}>
      <FlatList<ItemT>
        ref={ref}
        {...rest}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={makeRefreshControl(refreshing, onRefresh)}
      />
      <RefreshIndicator
        indicatorRef={indicatorRef}
        color={loaderColor ?? Colors.primary600}
      />
    </View>
  );
}

interface ScrollViewWrapperProps
  extends Omit<React.ComponentProps<typeof ScrollView>, 'refreshControl'> {
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
    children,
    ...rest
  } = props;

  const { indicatorRef, apply, isLockedRef } = useIndicator(refreshing);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isLockedRef.current) {
        const y = e.nativeEvent.contentOffset.y;
        const pull = clampPull(-y);
        apply(pull);
      }
      userOnScroll?.(e);
    },
    [apply, isLockedRef, userOnScroll],
  );

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={ref}
        {...rest}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={makeRefreshControl(refreshing, onRefresh)}
      >
        {children}
      </ScrollView>
      <RefreshIndicator
        indicatorRef={indicatorRef}
        color={loaderColor ?? Colors.primary600}
      />
    </View>
  );
}

interface SectionListWrapperProps<ItemT = any, SectionT = any>
  extends Omit<SectionListProps<ItemT, SectionT>, 'refreshControl'> {
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
    ...rest
  } = props;

  const { indicatorRef, apply, isLockedRef } = useIndicator(refreshing);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isLockedRef.current) {
        const y = e.nativeEvent.contentOffset.y;
        const pull = clampPull(-y);
        apply(pull);
      }
      userOnScroll?.(e);
    },
    [apply, isLockedRef, userOnScroll],
  );

  return (
    <View style={[styles.container, style]}>
      <SectionList<ItemT, SectionT>
        ref={ref}
        {...rest}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={makeRefreshControl(refreshing, onRefresh)}
      />
      <RefreshIndicator
        indicatorRef={indicatorRef}
        color={loaderColor ?? Colors.primary600}
      />
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
