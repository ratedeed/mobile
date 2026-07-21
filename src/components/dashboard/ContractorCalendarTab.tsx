import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface ContractorCalendarTabProps {
  calendarDate: Date;
  selectedDay: number | null;
  jobs: any[];
  isDark: boolean;
  setCalendarDate: (d: Date) => void;
  setSelectedDay: (day: number | null) => void;
  getJobDate: (job: any) => Date | null;
}

export const ContractorCalendarTab: React.FC<ContractorCalendarTabProps> = ({
  calendarDate,
  selectedDay,
  jobs,
  isDark,
  setCalendarDate,
  setSelectedDay,
  getJobDate,
}) => {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDayOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const nextMonth = () => {
    setCalendarDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };
  const prevMonth = () => {
    setCalendarDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const getJobsForDay = (day: number) => {
    return (jobs || []).filter((job) => {
      const d = getJobDate(job);
      if (!d) return false;
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const selectedDateJobs = selectedDay ? getJobsForDay(selectedDay) : [];

  const cells = [];
  for (let i = 0; i < firstDayOffset; i++) {
    cells.push({ key: `empty-${i}`, day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `day-${d}`, day: d });
  }

  return (
    <View className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
      {/* Header Month / Arrows */}
      <View className="flex-row items-center justify-between mb-4 px-1">
        <Text className="text-base font-bold text-neutral-900 dark:text-white">{monthName}</Text>
        <View className="flex-row" style={{ gap: 12 }}>
          <Pressable onPress={prevMonth} className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <FontAwesome5 name="chevron-left" size={10} color={isDark ? '#d4d4d4' : '#404040'} />
          </Pressable>
          <Pressable onPress={nextMonth} className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <FontAwesome5 name="chevron-right" size={10} color={isDark ? '#d4d4d4' : '#404040'} />
          </Pressable>
        </View>
      </View>

      {/* Days of Week Headers */}
      <View className="flex-row mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((lbl, idx) => (
          <Text key={idx} className="flex-1 text-center text-[10px] font-bold text-neutral-400">
            {lbl}
          </Text>
        ))}
      </View>

      {/* Monthly Date Grid */}
      <View className="flex-row flex-wrap">
        {cells.map((cell) => {
          const isSelected = cell.day === selectedDay;
          const hasJobs = cell.day ? getJobsForDay(cell.day).length > 0 : false;
          const isToday =
            cell.day &&
            new Date().getFullYear() === year &&
            new Date().getMonth() === month &&
            new Date().getDate() === cell.day;

          return (
            <Pressable
              key={cell.key}
              onPress={() => cell.day && setSelectedDay(cell.day)}
              disabled={!cell.day}
              className="w-[14.28%] aspect-square items-center justify-center p-0.5"
            >
              {cell.day && (
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center relative ${
                    isSelected ? 'bg-indigo-600' : isToday ? 'border border-indigo-600' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? 'text-white' : isToday ? 'text-indigo-600' : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    {cell.day}
                  </Text>
                  {hasJobs && (
                    <View
                      className={`absolute bottom-1 w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-indigo-600'
                      }`}
                    />
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Day Details List */}
      <View className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <Text className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
          {selectedDay
            ? `Schedule for ${calendarDate.toLocaleString('en-US', { month: 'short' })} ${selectedDay}`
            : 'Select a day'}
        </Text>
        {selectedDateJobs.length === 0 ? (
          <Text className="text-xs text-neutral-400 dark:text-neutral-500 py-4 text-center">
            No projects scheduled for this day.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {selectedDateJobs.map((j: any) => (
              <View
                key={j._id}
                className="bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/60 flex-row justify-between items-center"
              >
                <View className="flex-1 min-w-0 mr-2">
                  <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">
                    {j.title || 'Project'}
                  </Text>
                  <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                    Client: {j.user ? `${j.user.firstName || ''} ${j.user.lastName || ''}`.trim() : 'Homeowner'}
                  </Text>
                </View>
                <View className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 rounded">
                  <Text className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                    {j.status?.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

export default ContractorCalendarTab;
