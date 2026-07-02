import React, { useEffect, useRef } from 'react';
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
} from 'react-native';
import { BouncingDotsLoader } from './BouncingDotsLoader';
import { Colors } from '../../constants/designTokens';

const REFRESH_HEIGHT = 64;

const TRANSPARENT = 'rgba(0,0,0,0)';

interface RefreshOverlayProps {
  refreshing: boolean;
  color?: string;
}

const RefreshOverlay: React.FC<RefreshOverlayProps> = ({ refreshing, color }) => {
  const height = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (refreshing) {
      Animated.parallel([
        Animated.timing(height, {
          toValue: REFRESH_HEIGHT,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: false,
        }),
        Animated.timing(height, {
          toValue: 0,
          duration: 140,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [refreshing, height, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { height, opacity }]}
    >
      <BouncingDotsLoader size="medium" color={color ?? Colors.primary500} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});

interface BouncingRefreshFlatListProps<ItemT = any>
  extends Omit<FlatListProps<ItemT>, 'refreshControl' | 'style'> {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function BouncingRefreshFlatList<ItemT = any>(
  props: BouncingRefreshFlatListProps<ItemT>,
  ref: React.Ref<FlatList<ItemT>>,
) {
  const { refreshing, onRefresh, loaderColor, style, ...rest } = props;
  return (
    <View style={[{ flex: 1 }, style]}>
      <FlatList<ItemT>
        ref={ref}
        {...(rest as FlatListProps<ItemT>)}
        style={[{ flex: 1 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={TRANSPARENT}
            colors={[TRANSPARENT]}
            progressBackgroundColor={TRANSPARENT}
            title=""
          />
        }
      />
      <RefreshOverlay refreshing={refreshing} color={loaderColor} />
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

function BouncingRefreshScrollView(
  props: BouncingRefreshScrollViewProps,
  ref: React.Ref<ScrollView>,
) {
  const { refreshing, onRefresh, loaderColor, style, children, ...rest } = props;
  return (
    <View style={[{ flex: 1 }, style]}>
      <ScrollView
        ref={ref}
        {...(rest as React.ComponentProps<typeof ScrollView>)}
        style={[{ flex: 1 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={TRANSPARENT}
            colors={[TRANSPARENT]}
            progressBackgroundColor={TRANSPARENT}
            title=""
          />
        }
      >
        {children}
      </ScrollView>
      <RefreshOverlay refreshing={refreshing} color={loaderColor} />
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

function BouncingRefreshSectionList<ItemT = any, SectionT = any>(
  props: BouncingRefreshSectionListProps<ItemT, SectionT>,
  ref: React.Ref<SectionList<ItemT, SectionT>>,
) {
  const { refreshing, onRefresh, loaderColor, style, ...rest } = props;
  return (
    <View style={[{ flex: 1 }, style]}>
      <SectionList<ItemT, SectionT>
        ref={ref}
        {...(rest as SectionListProps<ItemT, SectionT>)}
        style={[{ flex: 1 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={TRANSPARENT}
            colors={[TRANSPARENT]}
            progressBackgroundColor={TRANSPARENT}
            title=""
          />
        }
      />
      <RefreshOverlay refreshing={refreshing} color={loaderColor} />
    </View>
  );
}

const ForwardedFlatList = React.forwardRef(BouncingRefreshFlatList) as <ItemT = any>(
  p: BouncingRefreshFlatListProps<ItemT> & { ref?: React.Ref<FlatList<ItemT>> },
) => React.ReactElement;

const ForwardedScrollView = React.forwardRef(BouncingRefreshScrollView);

const ForwardedSectionList = React.forwardRef(BouncingRefreshSectionList) as <ItemT = any, SectionT = any>(
  p: BouncingRefreshSectionListProps<ItemT, SectionT> & { ref?: React.Ref<SectionList<ItemT, SectionT>> },
) => React.ReactElement;

export {
  ForwardedFlatList as BouncingRefreshFlatList,
  ForwardedScrollView as BouncingRefreshScrollView,
  ForwardedSectionList as BouncingRefreshSectionList,
};
