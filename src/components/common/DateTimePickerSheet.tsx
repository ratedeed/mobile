import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { FontAwesome5 } from '@expo/vector-icons';
import HapticFeedback from '../../utils/haptics';

type Mode = 'date' | 'time';

interface DateTimePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  mode: Mode;
  title: string;
  value?: string;
  onConfirm: (value: string) => void;
  minDate?: string;
  timeSlots?: string[];
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

// Fallback bottom padding for phones with a home indicator (e.g. iPhone).
// If this app already uses react-native-safe-area-context elsewhere, swap
// this for `useSafeAreaInsets().bottom` for a pixel-perfect fit instead.
const BOTTOM_INSET_FALLBACK = 24;

// Drag-to-dismiss thresholds for the handle.
const DRAG_CLOSE_DISTANCE = 120;
const DRAG_CLOSE_VELOCITY = 0.8;

export default function DateTimePickerSheet({
  visible,
  onClose,
  mode,
  title,
  value,
  onConfirm,
  minDate,
  timeSlots,
}: DateTimePickerSheetProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // FontAwesome5's icon color prop can't read Tailwind's `dark:` classes,
  // so it needs an explicit light/dark pair.
  const iconColorActive = isDark ? '#818CF8' : '#4F46E5'; // indigo-400 / indigo-600
  const iconColorDisabled = isDark ? '#404040' : '#d4d4d4'; // neutral-700 / neutral-300
  const iconColorClose = isDark ? '#a3a3a3' : '#737373'; // neutral-400 / neutral-500

  // Was a one-time useMemo(() => new Date(), []) — went stale if the sheet
  // stayed mounted (hidden) across midnight. Now refreshed every time it opens.
  const [today, setToday] = useState(() => startOfDay(new Date()));

  const minDateD = useMemo(() => (minDate ? parseISODate(minDate) : null), [minDate]);
  const valueDate = useMemo(() => parseISODate(value), [value]);
  const selectedTimeNorm = useMemo(() => normalizeTime(value), [value]);
  const slots = timeSlots ?? TIME_SLOTS;

  const [viewMonth, setViewMonth] = useState(() => {
    const base = valueDate || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Drag-to-dismiss on the handle, using only core RN APIs (no extra deps).
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > DRAG_CLOSE_DISTANCE || gestureState.vy > DRAG_CLOSE_VELOCITY) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      const now = startOfDay(new Date());
      setToday(now);
      const base = valueDate || now;
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      translateY.setValue(0);
    }
    // Intentionally only re-runs when the sheet opens — resetting on every
    // `value`/`today` change would fight the user's in-progress month navigation.
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const arr: { date: Date; inMonth: boolean; iso: string }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      const day = daysInPrevMonth - (startWeekday - 1 - i);
      const d = new Date(year, month - 1, day);
      arr.push({ date: d, inMonth: false, iso: toISODate(d) });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      arr.push({ date: d, inMonth: true, iso: toISODate(d) });
    }
    let next = 1;
    while (arr.length < 42) {
      const d = new Date(year, month + 1, next++);
      arr.push({ date: d, inMonth: false, iso: toISODate(d) });
    }
    return arr;
  }, [viewMonth]);

  const canGoPrev = useMemo(() => {
    const limit = minDateD || today;
    const limitMonthStart = new Date(limit.getFullYear(), limit.getMonth(), 1);
    return new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1) > limitMonthStart;
  }, [viewMonth, minDateD, today]);

  const isDisabled = (d: Date) => {
    const limit = minDateD || today;
    return d < limit;
  };

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    HapticFeedback.selection();
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    HapticFeedback.selection();
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const handleSelectDate = (d: Date) => {
    if (isDisabled(d)) return;
    HapticFeedback.selection();
    onConfirm(toISODate(d));
    onClose();
  };

  const handleSelectTime = (slot: string) => {
    HapticFeedback.selection();
    onConfirm(slot);
    onClose();
  };

  const dayCellSize = Math.min(Math.floor((screenWidth - 80) / 7), 44);
  // Selected/today circle now scales with the cell instead of a fixed 36px,
  // so it can't overflow the cell bounds on narrow phones (e.g. iPhone SE).
  const circleSize = Math.max(Math.min(dayCellSize - 4, 36), 28);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Pressable
            className="bg-white dark:bg-neutral-900 rounded-t-3xl"
            style={{ maxHeight: '80%' }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle — drag down to dismiss */}
            <View className="items-center pt-3 pb-1" {...panResponder.panHandlers}>
              <View className="w-10 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <Text className="text-[16px] font-bold text-neutral-900 dark:text-neutral-50">{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <FontAwesome5 name="times" solid size={13} color={iconColorClose} />
              </Pressable>
            </View>

            {mode === 'date' ? (
              <>
                {/* Month nav */}
                <View className="flex-row items-center justify-between px-5 py-3">
                  <Pressable
                    onPress={handlePrevMonth}
                    disabled={!canGoPrev}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    className="w-9 h-9 items-center justify-center rounded-full"
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    accessibilityState={{ disabled: !canGoPrev }}
                  >
                    <FontAwesome5
                      name="chevron-left"
                      solid
                      size={14}
                      color={canGoPrev ? iconColorActive : iconColorDisabled}
                    />
                  </Pressable>
                  <Text className="text-[15px] font-bold text-neutral-900 dark:text-neutral-50">
                    {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                  </Text>
                  <Pressable
                    onPress={handleNextMonth}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    className="w-9 h-9 items-center justify-center rounded-full"
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                  >
                    <FontAwesome5 name="chevron-right" solid size={14} color={iconColorActive} />
                  </Pressable>
                </View>

                {/* Weekday labels */}
                <View className="flex-row px-3 pb-2">
                  {WEEKDAYS.map((w, i) => (
                    <View key={i} style={{ width: dayCellSize }} className="items-center">
                      <Text className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500">{w}</Text>
                    </View>
                  ))}
                </View>

                {/* Grid */}
                <ScrollView
                  className="px-3"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 + BOTTOM_INSET_FALLBACK, paddingTop: 4 }}
                >
                  <View className="flex-row flex-wrap" style={{ width: dayCellSize * 7 }}>
                    {cells.map((cell, i) => {
                      const isSelected = valueDate ? cell.iso === toISODate(valueDate) : false;
                      const isToday = cell.iso === toISODate(today);
                      const disabled = isDisabled(cell.date);
                      return (
                        <Pressable
                          key={i}
                          onPress={() => cell.inMonth && handleSelectDate(cell.date)}
                          disabled={!cell.inMonth || disabled}
                          style={{ width: dayCellSize, height: dayCellSize }}
                          className="items-center justify-center"
                          accessibilityRole={cell.inMonth ? 'button' : undefined}
                          accessibilityLabel={cell.inMonth ? cell.date.toDateString() : undefined}
                          accessibilityState={{ selected: isSelected, disabled: !cell.inMonth || disabled }}
                        >
                          {isSelected ? (
                            <View
                              style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2 }}
                              className="bg-indigo-600 items-center justify-center"
                            >
                              <Text className="text-[14px] font-bold text-white">{cell.date.getDate()}</Text>
                            </View>
                          ) : (
                            <View
                              style={{ width: circleSize, height: circleSize, borderRadius: circleSize / 2 }}
                              className={`items-center justify-center ${
                                cell.inMonth ? 'border' : ''
                              } ${isToday ? 'border-indigo-500' : 'border-transparent'}`}
                            >
                              <Text
                                className={`text-[14px] ${
                                  !cell.inMonth
                                    ? 'text-neutral-300 dark:text-neutral-700'
                                    : disabled
                                    ? 'text-neutral-300 dark:text-neutral-700'
                                    : 'text-neutral-800 dark:text-neutral-100'
                                } ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'font-medium'}`}
                              >
                                {cell.date.getDate()}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ) : (
              <ScrollView
                className="px-5 py-4"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 + BOTTOM_INSET_FALLBACK }}
              >
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {slots.map((slot) => {
                    const selected = timeSlots ? value === slot : selectedTimeNorm === slot;
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => handleSelectTime(slot)}
                        className={`px-4 py-2.5 rounded-xl border ${
                          selected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                        }`}
                        style={{ minWidth: 90 }}
                        accessibilityRole="button"
                        accessibilityLabel={slot}
                        accessibilityState={{ selected }}
                      >
                        <Text className={`text-[14px] font-semibold ${selected ? 'text-white' : 'text-neutral-800 dark:text-neutral-100'}`}>
                          {slot}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
