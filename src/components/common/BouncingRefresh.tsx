import React from 'react';
import {
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

const styles = StyleSheet.create({
  container: { flex: 1 },
});

interface CommonProps {
  refreshing: boolean;
  onRefresh: () => void;
  loaderColor?: string;
  style?: StyleProp<ViewStyle>;
}

function makeRefreshControl(refreshing: boolean, onRefresh: () => void, tintColor?: string) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={tintColor}
      colors={tintColor ? [tintColor] : undefined}
    />
  );
}

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
  return (
    <View style={[styles.container, style]}>
      <FlatList<ItemT>
        ref={ref}
        {...(rest as FlatListProps<ItemT>)}
        refreshControl={makeRefreshControl(refreshing, onRefresh, loaderColor)}
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
  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={ref}
        {...(rest as React.ComponentProps<typeof ScrollView>)}
        refreshControl={makeRefreshControl(refreshing, onRefresh, loaderColor)}
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
  return (
    <View style={[styles.container, style]}>
      <SectionList<ItemT, SectionT>
        ref={ref}
        {...(rest as SectionListProps<ItemT, SectionT>)}
        refreshControl={makeRefreshControl(refreshing, onRefresh, loaderColor)}
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
