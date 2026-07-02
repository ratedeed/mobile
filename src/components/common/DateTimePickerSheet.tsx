import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { FontAwesome5 } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/designTokens';

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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
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

function buildCalendarDays(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: ({ date: Date; iso: string; day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ date: d, iso: toISODate(d), day });
  }

  return cells;
}

// ─── Day Cell ──────────────────────────────────────────────────────────────────

type DayCellProps = {
  cell: { date: Date; iso: string; day: number } | null;
  isSelected: boolean;
  isToday: boolean;
  disabled: boolean;
  size: number;
  isDark: boolean;
  onPress: (date: Date) => void;
};

const DayCell = React.memo<DayCellProps>(({
  cell, isSelected, isToday, disabled, size, isDark, onPress,
}) => {
  if (!cell) {
    return <View style={{ width: size, height: size }} />;
  }

  const bg = isSelected
    ? '#222222'
    : 'transparent';
  const textColor = isSelected
    ? '#fff'
    : disabled
      ? (isDark ? '#3a3a3a' : '#ccc')
      : (isDark ? '#f5f5f5' : '#222');

  return (
    <Pressable
      onPress={() => !disabled && onPress(cell.date)}
      disabled={disabled}
      style={[
        styles.dayCell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Text style={[
        styles.dayCellText,
        {
          color: textColor,
          fontWeight: isSelected || isToday ? '700' : '400',
        },
      ]}>
        {cell.day}
      </Text>
      {isToday && !isSelected && (
        <View style={[styles.todayUnderline, { backgroundColor: isDark ? '#f5f5f5' : '#222' }]} />
      )}
    </Pressable>
  );
});

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DateTimePickerSheet({
  visible, onClose, mode, title, value, onConfirm, minDate, timeSlots,
}: DateTimePickerSheetProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const today = useMemo(() => startOfDay(new Date()), []);
  const minDateD = useMemo(() => (minDate ? parseISODate(minDate) : null), [minDate]);
  const valueDate = useMemo(() => parseISODate(value), [value]);
  const selectedTimeNorm = useMemo(() => normalizeTime(value), [value]);
  const slots = timeSlots ?? TIME_SLOTS;

  const [selectedDate, setSelectedDate] = useState<Date | null>(valueDate);
  const [selectedTime, setSelectedTime] = useState<string | null>(timeSlots ? (value ?? null) : selectedTimeNorm);

  // Current displayed month
  const initialMonth = valueDate || today;
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  // Animation (reanimated — runs on UI thread for 60+ FPS)
  const progress = useSharedValue(0);
  const [modalVisible, setModalVisible] = useState(false);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.45]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [600, 0]) }],
  }));

  useEffect(() => {
    if (visible) {
      setSelectedDate(valueDate);
      setSelectedTime(timeSlots ? (value ?? null) : selectedTimeNorm);
      const base = valueDate || today;
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
      setModalVisible(true);
      progress.value = withSpring(1, { damping: 28, stiffness: 340, mass: 0.7 });
    } else {
      progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setModalVisible)(false);
      });
    }
  }, [visible]);

  const animateOut = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const onDone = () => {
        setModalVisible(false);
        resolve();
      };
      progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    });
  }, [progress]);

  const handleClose = useCallback(() => {
    animateOut().then(() => onClose());
  }, [animateOut, onClose]);

  const handleSelectDate = useCallback((d: Date) => {
    setSelectedDate(d);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSelectTime = useCallback((slot: string) => {
    setSelectedTime(slot);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleConfirm = useCallback(() => {
    const val = mode === 'date'
      ? (selectedDate ? toISODate(selectedDate) : null)
      : selectedTime;
    if (!val) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Animate out first, then fire callbacks so parent re-render doesn't fight the animation
    animateOut().then(() => {
      onConfirm(val);
      onClose();
    });
  }, [mode, selectedDate, selectedTime, animateOut, onConfirm, onClose]);

  const handleClear = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Month navigation
  const goToPrevMonth = useCallback(() => {
    setViewMonth(prev => {
      if (prev === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewMonth(prev => {
      if (prev === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Check if prev month is navigable
  const canGoPrev = useMemo(() => {
    const limit = minDateD || today;
    const prevMonth = viewMonth === 0
      ? new Date(viewYear - 1, 11, 1)
      : new Date(viewYear, viewMonth - 1, 1);
    const limitMonth = new Date(limit.getFullYear(), limit.getMonth(), 1);
    return prevMonth >= limitMonth;
  }, [viewYear, viewMonth, minDateD, today]);

  const calendarDays = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const dayCellSize = Math.min(Math.floor((screenWidth - 72) / 7), 48);

  const sheetBg = isDark ? '#1a1a1a' : '#fff';
  const headerColor = isDark ? '#f5f5f5' : '#222';
  const subtleColor = isDark ? '#888' : '#717171';

  if (!modalVisible && !visible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            backdropStyle,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              paddingBottom: Math.max(insets.bottom, 20),
              maxHeight: '88%',
            },
            sheetStyle,
          ]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: isDark ? '#444' : '#ddd' }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: headerColor }]}>{title}</Text>
            </View>
            <Pressable
              onPress={handleClose}
              style={[styles.closeButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
              hitSlop={8}
            >
              <FontAwesome5 name="times" size={12} color={subtleColor} />
            </Pressable>
          </View>

          {mode === 'time' ? (
            /* ──── TIME PICKER ──── */
            <ScrollView
              contentContainerStyle={styles.timeContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
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
                          backgroundColor: selected
                            ? '#222'
                            : (isDark ? '#2a2a2a' : '#f7f7f7'),
                          borderColor: selected
                            ? '#222'
                            : (isDark ? '#3a3a3a' : '#ebebeb'),
                        },
                      ]}
                    >
                      <Text style={[
                        styles.timeChipText,
                        {
                          color: selected ? '#fff' : (isDark ? '#e5e5e5' : '#222'),
                          fontWeight: selected ? '600' : '400',
                        },
                      ]}>
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            /* ──── DATE PICKER ──── */
            <View style={styles.calendarContainer}>
              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <Pressable
                  onPress={goToPrevMonth}
                  disabled={!canGoPrev}
                  style={[styles.navArrow, { opacity: canGoPrev ? 1 : 0.25 }]}
                  hitSlop={12}
                >
                  <FontAwesome5 name="chevron-left" size={14} color={headerColor} />
                </Pressable>
                <Text style={[styles.monthLabel, { color: headerColor }]}>
                  {MONTHS[viewMonth]} {viewYear}
                </Text>
                <Pressable onPress={goToNextMonth} style={styles.navArrow} hitSlop={12}>
                  <FontAwesome5 name="chevron-right" size={14} color={headerColor} />
                </Pressable>
              </View>

              {/* Weekday Headers */}
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((w, i) => (
                  <View key={i} style={{ width: dayCellSize, alignItems: 'center' }}>
                    <Text style={[styles.weekdayText, { color: subtleColor }]}>
                      {w}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]} />

              {/* Calendar Grid */}
              <View style={styles.daysGrid}>
                {calendarDays.map((cell, i) => {
                  if (!cell) return <View key={`empty-${i}`} style={{ width: dayCellSize, height: dayCellSize }} />;
                  const isSelected = selectedDate ? isSameDay(cell.date, selectedDate) : false;
                  const isToday = isSameDay(cell.date, today);
                  const disabled = minDateD ? cell.date < minDateD : cell.date < today;
                  return (
                    <DayCell
                      key={cell.iso}
                      cell={cell}
                      isSelected={isSelected}
                      isToday={isToday}
                      disabled={disabled}
                      size={dayCellSize}
                      isDark={isDark}
                      onPress={handleSelectDate}
                    />
                  );
                })}
              </View>

              {/* Today shortcut */}
              {!(viewYear === today.getFullYear() && viewMonth === today.getMonth()) && (
                <Pressable
                  onPress={() => {
                    setViewYear(today.getFullYear());
                    setViewMonth(today.getMonth());
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.todayBtn}
                >
                  <Text style={[styles.todayBtnText, { color: isDark ? '#f5f5f5' : '#222' }]}>
                    Go to today
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
            <Pressable onPress={handleClear} style={styles.clearBtn}>
              <Text style={[styles.clearText, { color: isDark ? '#e5e5e5' : '#222' }]}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={mode === 'date' ? !selectedDate : !selectedTime}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: (mode === 'date' ? selectedDate : selectedTime)
                    ? '#222'
                    : (isDark ? '#2a2a2a' : '#e5e5e5'),
                },
              ]}
            >
              <Text style={[
                styles.saveBtnText,
                {
                  color: (mode === 'date' ? selectedDate : selectedTime)
                    ? '#fff'
                    : (isDark ? '#555' : '#aaa'),
                },
              ]}>
                Save
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Calendar
  calendarContainer: {
    paddingHorizontal: 20,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  divider: {
    height: 1,
    marginBottom: 8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellText: {
    fontSize: 15,
  },
  todayUnderline: {
    position: 'absolute',
    bottom: 8,
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  todayBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  todayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Time
  timeContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeChip: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  timeChipText: {
    fontSize: 15,
    letterSpacing: -0.1,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
    borderTopWidth: 1,
    marginTop: 16,
  },
  clearBtn: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  clearText: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  saveBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
