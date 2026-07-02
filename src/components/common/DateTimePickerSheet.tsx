import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { FontAwesome5 } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/designTokens';

type Mode = 'date' | 'time';

interface DateTimePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: Mode;
  title: string;
  value?: string;              // ISO date "YYYY-MM-DD" or time "h:mm AM"
  onConfirm: (value: string) => void;
  minDate?: string;
  timeSlots?: string[];
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Date helpers ────────────────────────────────────────────────────
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:${String(minute).padStart(2, '0')} ${period}`;
}

function normalizeTime(s?: string): string | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const period = m[3].toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return formatTime(hour, minute);
}

const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 5; h <= 23; h++) {
    slots.push(formatTime(h, 0));
    if (h !== 23) slots.push(formatTime(h, 30));
  }
  return slots;
})();

// ─── Build months to render (HorizonCalendar-style vertical scroll) ──
function buildMonthData(monthStart: Date, minDate: Date | null, today: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Only render current-month days; leading empty cells for weekday alignment
  const cells: ({ date: Date; iso: string } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ date: d, iso: toISODate(d) });
  }
  // NO trailing fill — variable row count, like HorizonCalendar

  return { year, month, cells };
}

// ─── Animated day cell ───────────────────────────────────────────────
type DayCellProps = {
  cell: { date: Date; iso: string } | null;
  isSelected: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isToday: boolean;
  disabled: boolean;
  size: number;
  isDark: boolean;
  reduceMotion: boolean;
  onPress: (date: Date) => void;
};

const DayCell = React.memo<DayCellProps>(({
  cell, isSelected, isRangeStart, isRangeEnd, isInRange, isToday,
  disabled, size, isDark, reduceMotion, onPress,
}) => {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled || reduceMotion) return;
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    if (disabled || reduceMotion) return;
    scale.value = withSpring(1, { damping: 14, stiffness: 280 });
  };

  if (!cell) {
    return <View style={{ width: size, height: size }} />;
  }

  const bgColor = isSelected
    ? Colors.primary600
    : isInRange
      ? (isDark ? 'rgba(79,70,229,0.15)' : 'rgba(79,70,229,0.10)')
      : 'transparent';
  const textColor = isSelected
    ? '#fff'
    : disabled
      ? (isDark ? '#525252' : '#d4d4d4')
      : isToday
        ? Colors.primary600
        : (isDark ? '#fafafa' : '#262626');

  return (
    <Animated.View style={[{ width: size, height: size }, animStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => !disabled && onPress(cell.date)}
        disabled={disabled}
        style={[styles.cellInner, {
          backgroundColor: bgColor,
          borderRadius: size / 2,
          // Range bar: connect start/middle/end with a continuous fill
          borderTopLeftRadius: isRangeStart || isInRange ? 0 : size / 2,
          borderBottomLeftRadius: isRangeStart || isInRange ? 0 : size / 2,
          borderTopRightRadius: isRangeEnd || isInRange ? 0 : size / 2,
          borderBottomRightRadius: isRangeEnd || isInRange ? 0 : size / 2,
        }]}
      >
        <Text style={[styles.cellText, { color: textColor, fontSize: size * 0.34 }]}>
          {cell.date.getDate()}
        </Text>
        {isToday && !isSelected && (
          <View style={[styles.todayDot, { backgroundColor: Colors.primary600 }]} />
        )}
      </Pressable>
    </Animated.View>
  );
});

// ─── Month header ────────────────────────────────────────────────────
const MonthHeader = React.memo<{ monthStart: Date; isDark: boolean }>(
  ({ monthStart, isDark }) => (
    <View style={styles.monthHeader}>
      <Text style={[styles.monthTitle, { color: isDark ? '#fafafa' : '#171717' }]}>
        {MONTHS[monthStart.getMonth()]} {monthStart.getFullYear()}
      </Text>
    </View>
  )
);

// ─── Main component ──────────────────────────────────────────────────
export default function DateTimePickerSheet({
  visible, onClose, mode, title, value, onConfirm, minDate, timeSlots,
}: DateTimePickerSheetProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const reduceMotion = useReducedMotion() ?? false;

  const today = useMemo(() => startOfDay(new Date()), []);
  const minDateD = useMemo(() => (minDate ? parseISODate(minDate) : null), [minDate]);
  const valueDate = useMemo(() => parseISODate(value), [value]);
  const selectedTimeNorm = useMemo(() => normalizeTime(value), [value]);
  const slots = timeSlots ?? TIME_SLOTS;

  // Single-date selection (no range in this version — Airbnb uses range
  // for booking, but RateDeed may only need single date for booking a contractor)
  const [selectedDate, setSelectedDate] = useState<Date | null>(valueDate);
  const [selectedTime, setSelectedTime] = useState<string | null>(timeSlots ? (value ?? null) : selectedTimeNorm);
  const [scrollIndex, setScrollIndex] = useState(0);

  const sheetRef = useRef<any>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  // Build months: current + 11 forward = 12 months total (Airbnb default)
  const months = useMemo(() => {
    const base = valueDate || today;
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const limit = minDateD || today;
    return Array.from({ length: 12 }, (_, i) => {
      const monthStart = addMonths(start, i);
      if (monthStart < new Date(limit.getFullYear(), limit.getMonth(), 1)) return null;
      return buildMonthData(monthStart, minDateD, today);
    }).filter(Boolean) as ReturnType<typeof buildMonthData>[];
  }, [valueDate, today, minDateD]);

  // Reset state when sheet opens
  useEffect(() => {
    if (visible) {
      setSelectedDate(valueDate);
      setSelectedTime(timeSlots ? (value ?? null) : selectedTimeNorm);
      setScrollIndex(0);
      sheetRef.current?.snapToIndex(0);
    }
  }, [visible]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Close handler — animate sheet down then call onClose
  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    // onClose fires via onChange when index reaches -1
  }, []);

  const handleSheetChange = useCallback((idx: number) => {
    if (idx === -1) onClose();
  }, [onClose]);

  // ─── Date selection with haptic ──────────────────────────────────
  const handleSelectDate = useCallback((d: Date) => {
    setSelectedDate(d);
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [reduceMotion]);

  // ─── Time selection with haptic ──────────────────────────────────
  const handleSelectTime = useCallback((slot: string) => {
    setSelectedTime(slot);
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [reduceMotion]);

  // ─── Confirm: validate, fire callback, close ─────────────────────
  const handleConfirm = useCallback(() => {
    if (mode === 'date') {
      if (!selectedDate) return;
      onConfirm(toISODate(selectedDate));
    } else {
      if (!selectedTime) return;
      onConfirm(selectedTime);
    }
    if (!reduceMotion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    handleClose();
  }, [mode, selectedDate, selectedTime, onConfirm, handleClose, reduceMotion]);

  // ─── Clear: reset selection ──────────────────────────────────────
  const handleClear = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime(null);
    if (!reduceMotion) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [reduceMotion]);

  // ─── Scroll to today ─────────────────────────────────────────────
  const scrollToToday = useCallback(() => {
    const todayIdx = months.findIndex(m =>
      m.year === today.getFullYear() && m.month === today.getMonth()
    );
    if (todayIdx >= 0) {
      setScrollIndex(todayIdx);
      if (!reduceMotion) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [months, today, reduceMotion]);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior="close"
    />
  ), []);

  const dayCellSize = Math.min(Math.floor((screenWidth - 64) / 7), 44);

  if (!visible) return null;

  const sheetCommonProps = {
    ref: sheetRef,
    index: 0,
    enablePanDownToClose: true,
    backdropComponent: renderBackdrop,
    onChange: handleSheetChange,
    backgroundStyle: { backgroundColor: isDark ? '#171717' : '#fff', borderRadius: 24 },
    handleIndicatorStyle: { width: 40, backgroundColor: isDark ? '#525252' : '#d4d4d4' },
    animationConfigs: { damping: 28, stiffness: 380, mass: 0.8 },
  };

  // ─── Time mode ───────────────────────────────────────────────────
  if (mode === 'time') {
    return (
      <Modal visible transparent animationType="none" onRequestClose={handleClose}>
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          <BottomSheet {...sheetCommonProps} snapPoints={['60%']}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: isDark ? '#fafafa' : '#171717' }]}>
                {title}
              </Text>
              <Pressable onPress={handleClose} style={styles.closeBtn}>
                <FontAwesome5 name="times" size={14} color={isDark ? '#a3a3a3' : '#737373'} />
              </Pressable>
            </View>

            <BottomSheetScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.timeGrid}>
                {slots.map((slot) => {
                  const selected = selectedTime === slot;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => handleSelectTime(slot)}
                      style={[
                        styles.timeChip,
                        {
                          backgroundColor: selected ? Colors.primary600 : (isDark ? '#262626' : '#fafafa'),
                          borderColor: selected ? Colors.primary600 : (isDark ? '#404040' : '#e5e5e5'),
                        },
                      ]}
                    >
                      <Text style={[
                        styles.timeChipText,
                        { color: selected ? '#fff' : (isDark ? '#fafafa' : '#262626') },
                      ]}>
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </BottomSheetScrollView>

            {/* Footer — Clear + Confirm (Airbnb always has explicit actions) */}
            <View style={[styles.footer, { borderTopColor: isDark ? '#262626' : '#f0f0f0' }]}>
              <Pressable onPress={handleClear} style={styles.footerClearBtn}>
                <Text style={[styles.footerClearText, { color: Colors.primary600 }]}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={!selectedTime}
                style={[styles.footerConfirmBtn, {
                  backgroundColor: selectedTime ? Colors.primary600 : (isDark ? '#262626' : '#e5e5e5'),
                }]}
              >
                <Text style={[styles.footerConfirmText, {
                  color: selectedTime ? '#fff' : (isDark ? '#525252' : '#a3a3a3'),
                }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </BottomSheet>
        </GestureHandlerRootView>
      </Modal>
    );
  }

  // ─── Date mode ───────────────────────────────────────────────────
  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <BottomSheet {...sheetCommonProps} snapPoints={snapPoints}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: isDark ? '#fafafa' : '#171717' }]}>
              {title}
            </Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <FontAwesome5 name="times" size={14} color={isDark ? '#a3a3a3' : '#737373'} />
            </Pressable>
          </View>

          {/* Weekday row — sticky above the scrolling months */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={{ width: dayCellSize, alignItems: 'center' }}>
                <Text style={[styles.weekdayText, { color: isDark ? '#737373' : '#a3a3a3' }]}>
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* Today quick-scroll button — Airbnb pattern */}
          <View style={styles.todayBar}>
            <Pressable onPress={scrollToToday} style={styles.todayPill}>
              <Text style={[styles.todayPillText, { color: Colors.primary600 }]}>Today</Text>
            </Pressable>
          </View>

          {/* Vertically scrolling months — HorizonCalendar pattern */}
          <BottomSheetFlatList
            data={months}
            keyExtractor={(item) => `${item.year}-${item.month}`}
            initialScrollIndex={scrollIndex}
            getItemLayout={(_data, idx) => ({
              length: 380,  // approx month height — tune for your cell size
              offset: 380 * idx,
              index: idx,
            })}
            renderItem={({ item: monthData }) => (
              <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
                <MonthHeader monthStart={new Date(monthData.year, monthData.month, 1)} isDark={isDark} />
                <View style={styles.daysGrid}>
                  {monthData.cells.map((cell, i) => {
                    if (!cell) return <View key={i} style={{ width: dayCellSize, height: dayCellSize }} />;
                    const isSelected = selectedDate ? isSameDay(cell.date, selectedDate) : false;
                    const isToday = isSameDay(cell.date, today);
                    const disabled = minDateD ? cell.date < minDateD : cell.date < today;
                    return (
                      <DayCell
                        key={i}
                        cell={cell}
                        isSelected={isSelected}
                        isRangeStart={false}
                        isRangeEnd={false}
                        isInRange={false}
                        isToday={isToday}
                        disabled={disabled}
                        size={dayCellSize}
                        isDark={isDark}
                        reduceMotion={reduceMotion}
                        onPress={handleSelectDate}
                      />
                    );
                  })}
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />

          {/* Footer — Clear + Confirm */}
          <View style={[styles.footer, { borderTopColor: isDark ? '#262626' : '#f0f0f0' }]}>
            <Pressable onPress={handleClear} style={styles.footerClearBtn}>
              <Text style={[styles.footerClearText, { color: Colors.primary600 }]}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!selectedDate}
              style={[styles.footerConfirmBtn, {
                backgroundColor: selectedDate ? Colors.primary600 : (isDark ? '#262626' : '#e5e5e5'),
              }]}
            >
              <Text style={[styles.footerConfirmText, {
                color: selectedDate ? '#fff' : (isDark ? '#525252' : '#a3a3a3'),
              }]}>
                Save
              </Text>
            </Pressable>
          </View>
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'space-around',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  todayBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  todayPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(79,70,229,0.08)',
  },
  todayPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthHeader: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cellInner: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
  },
  cellText: {
    fontWeight: '600',
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  footerClearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerClearText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footerConfirmBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  footerConfirmText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
