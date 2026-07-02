import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Modal,
  FlatList,
  Animated,
  PanResponder,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { FontAwesome5 } from '@expo/vector-icons';
import HapticFeedback from '../../utils/haptics';
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

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
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

type Cell = { date: Date; iso: string } | null;

function buildMonthData(monthStart: Date): { year: number; month: number; cells: Cell[] } {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Cell[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({ date: d, iso: toISODate(d) });
  }
  while (cells.length < 42) cells.push(null);
  return { year, month, cells };
}

const DayCell = React.memo<{
  cell: Cell;
  isSelected: boolean;
  isToday: boolean;
  disabled: boolean;
  size: number;
  isDark: boolean;
  onPress: (date: Date) => void;
}>(({ cell, isSelected, isToday, disabled, size, isDark, onPress }) => {
  if (!cell) return <View style={{ width: size, height: size }} />;
  const circle = size - 6;
  const bgColor = isSelected ? Colors.primary600 : 'transparent';
  const textColor = isSelected
    ? '#fff'
    : disabled
      ? (isDark ? '#525252' : '#d4d4d4')
      : isToday
        ? Colors.primary600
        : (isDark ? '#fafafa' : '#262626');
  return (
    <Pressable
      onPress={() => !disabled && onPress(cell.date)}
      disabled={disabled}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{
        width: circle, height: circle, borderRadius: circle / 2,
        backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: textColor, fontSize: size * 0.34, fontWeight: '600' }}>
          {cell.date.getDate()}
        </Text>
      </View>
    </Pressable>
  );
});

export default function DateTimePickerSheet({
  visible, onClose, mode, title, value, onConfirm, minDate, timeSlots,
}: DateTimePickerSheetProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const today = useMemo(() => startOfDay(new Date()), [visible]);
  const minDateD = useMemo(() => (minDate ? parseISODate(minDate) : null), [minDate]);
  const valueDate = useMemo(() => parseISODate(value), [value]);
  const selectedTimeNorm = useMemo(() => normalizeTime(value), [value]);
  const slots = timeSlots ?? TIME_SLOTS;

  const dayCellSize = Math.min(Math.floor((screenWidth - 64) / 7), 44);
  const monthHeight = 6 * dayCellSize + 52 + 24;

  const months = useMemo(() => {
    const base = minDateD || today;
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    return Array.from({ length: 12 }, (_, i) => buildMonthData(addMonths(start, i)));
  }, [minDateD, today]);

  const initialIndex = useMemo(() => {
    if (!valueDate) return 0;
    const idx = months.findIndex(m => m.year === valueDate.getFullYear() && m.month === valueDate.getMonth());
    return idx >= 0 ? idx : 0;
  }, [valueDate, months]);

  const isDisabled = (d: Date) => d < (minDateD || today);

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

  const listRef = useRef<FlatList>(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: isDark ? '#171717' : '#fff' }]} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={styles.handleBar}>
            <View style={[styles.handle, { backgroundColor: isDark ? '#525252' : '#d4d4d4' }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#fafafa' : '#171717' }]}>{title}</Text>
            <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? '#262626' : '#f4f4f5' }]}>
              <FontAwesome5 name="times" size={14} color={isDark ? '#a3a3a3' : '#737373'} />
            </Pressable>
          </View>

          {mode === 'date' ? (
            <>
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((w, i) => (
                  <View key={i} style={{ width: dayCellSize, alignItems: 'center' }}>
                    <Text style={[styles.weekdayText, { color: isDark ? '#737373' : '#a3a3a3' }]}>{w}</Text>
                  </View>
                ))}
              </View>

              <FlatList
                ref={listRef}
                data={months}
                keyExtractor={(item) => `${item.year}-${item.month}`}
                initialScrollIndex={initialIndex}
                getItemLayout={(_data, index) => ({
                  length: monthHeight,
                  offset: monthHeight * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <View style={{ paddingHorizontal: 16, marginBottom: 24, height: monthHeight }}>
                    <View style={{ height: 52, justifyContent: 'center' }}>
                      <Text style={[styles.monthTitle, { color: isDark ? '#fafafa' : '#171717' }]}>
                        {MONTHS[item.month]} {item.year}
                      </Text>
                    </View>
                    <View style={styles.daysGrid}>
                      {item.cells.map((cell: Cell, i: number) => {
                        const isSelected = !!(cell && valueDate && isSameDay(cell.date, valueDate));
                        const isToday = cell ? isSameDay(cell.date, today) : false;
                        const disabled = cell ? isDisabled(cell.date) : false;
                        return (
                          <DayCell
                            key={i}
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
                  </View>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </>
          ) : (
            <FlatList
              data={slots}
              keyExtractor={(item) => item}
              numColumns={3}
              renderItem={({ item: slot }) => {
                const selected = timeSlots ? value === slot : selectedTimeNorm === slot;
                return (
                  <Pressable
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
              }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 40 }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeChip: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
