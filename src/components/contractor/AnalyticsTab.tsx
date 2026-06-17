import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, useColorScheme } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

type DateRange = 'week' | 'month' | 'quarter' | 'year';

const dateRangeLabels: Record<DateRange, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
};

interface AnalyticsTabProps {
  jobs: any[];
  quotes: any[];
  reviews: any[];
  profile: any;
  loading?: boolean;
  onViewAllJobs?: () => void;
}

export default function AnalyticsTab({ jobs, quotes, reviews, profile, loading, onViewAllJobs }: AnalyticsTabProps) {
  const isDark = useColorScheme() === 'dark';
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  const kpiData = useMemo(() => {
    const completedJobs = jobs.filter((j: any) => j.status === 'completed' || j.status === 'paid');
    const totalRevenue = completedJobs.reduce((sum: number, j: any) => sum + (j.totalAmount || j.amount || 0), 0);
    const activeJobsList = jobs.filter((j: any) => !['completed', 'cancelled', 'refunded', 'rejected', 'declined'].includes(j.status));
    const avgRating = profile?.averageRating || profile?.rating || 0;
    const reviewCount = profile?.reviewCount || reviews.length || 0;
    const respondedQuotes = quotes.filter((q: any) => q.status !== 'pending' && q.status !== 'draft');
    const responseRate = quotes.length > 0 ? Math.round((respondedQuotes.length / quotes.length) * 100) : 100;

    return { totalRevenue, activeJobs: activeJobsList.length, responseRate, avgRating, reviewCount };
  }, [jobs, quotes, reviews, profile]);

  const performanceMetrics = useMemo(() => {
    const accepted = quotes.filter((q: any) => q.status === 'accepted' || q.status === 'paid' || q.status === 'completed').length;
    const conversionRate = quotes.length > 0 ? Math.round((accepted / quotes.length) * 100) : 0;

    // On-time completion: completed jobs with estimatedCompletionDate that finished before deadline
    const completedWithDates = jobs.filter((j: any) =>
      (j.status === 'completed' || j.status === 'paid') && j.estimatedCompletionDate
    );
    let onTimeRate = 0;
    if (completedWithDates.length > 0) {
      const onTime = completedWithDates.filter((j: any) => {
        const completed = new Date(j.completedAt || j.updatedAt);
        const estimated = new Date(j.estimatedCompletionDate);
        return completed <= estimated;
      });
      onTimeRate = Math.round((onTime.length / completedWithDates.length) * 100);
    }

    // Repeat client rate: clients with >1 job / total unique clients
    const clientCounts: Record<string, number> = {};
    jobs.forEach((j: any) => {
      const name = j.client?.firstName || j.user?.firstName || 'unknown';
      clientCounts[name] = (clientCounts[name] || 0) + 1;
    });
    const uniqueClients = Object.keys(clientCounts).length;
    const repeatClients = Object.values(clientCounts).filter((c) => c > 1).length;
    const repeatRate = uniqueClients > 0 ? Math.round((repeatClients / uniqueClients) * 100) : 0;

    return { conversionRate, avgResponseTime: '—', onTimeRate, repeatRate };
  }, [quotes, jobs]);

  const earningsData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData: Record<string, number> = {};
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1);
      monthlyData[months[past.getMonth()]] = 0;
    }
    const completedJobs = jobs.filter((j: any) => j.status === 'completed' || j.status === 'paid');
    completedJobs.forEach((j: any) => {
      const dateStr = j.completedAt || j.updatedAt || j.createdAt;
      if (dateStr) {
        const date = new Date(dateStr);
        const monthName = months[date.getMonth()];
        if (monthlyData[monthName] !== undefined) {
          monthlyData[monthName] += (j.totalAmount || j.amount || 0);
        }
      }
    });
    return Object.entries(monthlyData).map(([month, value]) => ({ month, value }));
  }, [jobs]);

  const serviceBreakdown = useMemo(() => {
    const completedJobs = jobs.filter((j: any) => j.status === 'completed' || j.status === 'paid');
    const breakdown: Record<string, number> = {};
    completedJobs.forEach((j: any) => {
      const category = j.category || j.serviceType || 'General Service';
      breakdown[category] = (breakdown[category] || 0) + (j.totalAmount || j.amount || 0);
    });
    const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];
    const res = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount], index) => ({
      name, amount, color: colors[index % colors.length],
    }));
    if (res.length === 0) return [{ name: 'No completed jobs yet', amount: 0, color: '#6366f1' }];
    return res;
  }, [jobs]);

  const topClients = useMemo(() => {
    const clients: Record<string, any> = {};
    jobs.forEach((j: any) => {
      const name = j.client?.firstName ? `${j.client.firstName} ${j.client.lastName || ''}`.trim() : j.user?.firstName ? `${j.user.firstName} ${j.user.lastName || ''}`.trim() : 'Unknown Client';
      if (!clients[name]) clients[name] = { name, jobs: 0, total: 0, lastProject: '', avatar: '👤' };
      clients[name].jobs += 1;
      clients[name].total += (j.totalAmount || j.amount || 0);
      const dateStr = j.updatedAt || j.createdAt;
      if (dateStr) {
        const date = new Date(dateStr);
        clients[name].lastProject = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    });
    const res = Object.values(clients).sort((a: any, b: any) => b.total - a.total).slice(0, 3);
    if (res.length === 0) return [{ name: 'No clients yet', jobs: 0, total: 0, lastProject: 'None', avatar: '👤' }];
    return res;
  }, [jobs]);

  const recentActivity = useMemo(() => {
    const activities: any[] = [];
    jobs.forEach((j: any) => {
      const isCompleted = j.status === 'completed';
      activities.push({
        id: `job-${j.id || j._id}`,
        title: isCompleted ? 'Job completed' : 'Job started',
        description: `${j.category || j.serviceType || 'Service'} for ${j.client?.firstName || j.user?.firstName || 'Client'}`,
        time: j.updatedAt || j.createdAt || new Date().toISOString(),
        date: new Date(j.updatedAt || j.createdAt || Date.now()),
        icon: isCompleted ? 'check-circle' : 'play-circle',
        colorClass: isCompleted ? 'bg-neutral-100' : 'bg-indigo-50',
        iconColor: isCompleted ? '#525252' : '#4F46E5',
      });
    });
    quotes.forEach((q: any) => {
      activities.push({
        id: `quote-${q.id || q._id}`,
        title: 'New quote request',
        description: `${q.serviceType || q.description || 'Service'} for ${q.client?.firstName || q.user?.firstName || 'Client'}`,
        time: q.createdAt || new Date().toISOString(),
        date: new Date(q.createdAt || Date.now()),
        icon: 'file-invoice',
        colorClass: 'bg-blue-50',
        iconColor: '#3b82f6',
      });
    });
    activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    const res = activities.slice(0, 5).map((a: any) => {
      const now = new Date();
      const diffMs = now.getTime() - a.date.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const diffDays = Math.round(diffHours / 24);
      let timeStr = 'Just now';
      if (diffHours > 0 && diffHours < 24) timeStr = `${diffHours}h ago`;
      else if (diffDays >= 1) timeStr = `${diffDays}d ago`;
      return { ...a, time: timeStr };
    });
    if (res.length === 0) return [{ id: 'none', title: 'No activity yet', description: 'When you get quotes or jobs, they will appear here.', time: 'Now', icon: 'chart-line', colorClass: 'bg-neutral-100', iconColor: '#525252' }];
    return res;
  }, [jobs, quotes]);

  const totalServiceRevenue = serviceBreakdown.reduce((sum, s) => sum + s.amount, 0);
  const maxEarning = Math.max(...earningsData.map(d => d.value), 1000);

  if (loading) {
    return (
      <View className="items-center justify-center py-12">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
      <View style={{ gap: 12 }}>

        {/* Date Range Selector */}
        <View className="relative">
          <TouchableOpacity
            onPress={() => setShowDropdown(!showDropdown)}
            className="self-end flex-row items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-1.5"
            style={{ gap: 4 }}
          >
            <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">{dateRangeLabels[dateRange]}</Text>
            <FontAwesome5 name="chevron-down" size={9} color={isDark ? "#a3a3a3" : "#525252"} />
          </TouchableOpacity>
          {showDropdown && (
            <View className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 py-1 min-w-[140px]" style={{ elevation: 8 }}>
              {(['week', 'month', 'quarter', 'year'] as DateRange[]).map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setDateRange(key); setShowDropdown(false); }}
                  className={`px-3 py-2 ${dateRange === key ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                >
                  <Text className={`text-xs font-medium ${dateRange === key ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                    {dateRangeLabels[key]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* KPI Cards */}
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {/* Revenue */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700" style={{ width: '48%' }}>
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <View className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 items-center justify-center">
                <FontAwesome5 name="dollar-sign" size={12} color="#059669" />
              </View>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">Revenue</Text>
            </View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">${kpiData.totalRevenue.toLocaleString()}</Text>
          </View>

          {/* Active Jobs */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700" style={{ width: '48%' }}>
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <View className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 items-center justify-center">
                <FontAwesome5 name="briefcase" size={11} color="#4F46E5" />
              </View>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">Active Jobs</Text>
            </View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">{kpiData.activeJobs}</Text>
          </View>

          {/* Response Rate */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700" style={{ width: '48%' }}>
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <View className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-900/20 items-center justify-center">
                <FontAwesome5 name="chart-line" size={11} color="#0284c7" />
              </View>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">Response Rate</Text>
            </View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">{kpiData.responseRate}%</Text>
            <View className="mt-1.5 w-full bg-neutral-100 dark:bg-neutral-700 rounded-full h-1.5">
              <View className="h-1.5 rounded-full bg-sky-500" style={{ width: `${kpiData.responseRate}%` }} />
            </View>
          </View>

          {/* Avg Rating */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700" style={{ width: '48%' }}>
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <View className="w-7 h-7 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 items-center justify-center">
                <FontAwesome5 name="star" size={11} color="#eab308" solid />
              </View>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">Avg. Rating</Text>
            </View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">{kpiData.avgRating.toFixed(1)}</Text>
            <View className="flex-row items-center mt-1" style={{ gap: 2 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <FontAwesome5 key={i} name="star" size={8} color={i <= Math.round(kpiData.avgRating) ? '#eab308' : (isDark ? '#404040' : '#e5e5e5')} solid />
              ))}
              <Text className="text-[9px] text-neutral-500 dark:text-neutral-400 ml-1">({kpiData.reviewCount})</Text>
            </View>
          </View>
        </View>

        {/* Monthly Revenue Bar Chart */}
        <View className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-100 dark:border-neutral-700">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-sm font-bold text-neutral-900 dark:text-white">Monthly Revenue</Text>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">Last 6 months</Text>
            </View>
            <FontAwesome5 name="chart-bar" size={14} color={isDark ? "#737373" : "#a3a3a3"} />
          </View>
          <View className="flex-row items-end justify-between" style={{ height: 130, gap: 8 }}>
            {earningsData.map((d, i) => {
              const barHeight = maxEarning > 0 ? Math.max((d.value / maxEarning) * 100, 4) : 4;
              const isSelected = selectedBar === i;
              return (
                <TouchableOpacity
                  key={d.month}
                  className="flex-1 items-center"
                  onPress={() => setSelectedBar(selectedBar === i ? null : i)}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <View className="bg-neutral-900 rounded-md px-2 py-1 mb-1">
                      <Text className="text-[9px] text-white font-bold">${(d.value / 1000).toFixed(1)}k</Text>
                    </View>
                  )}
                  <View className="w-full rounded-t-md" style={{ height: `${barHeight}%`, backgroundColor: isSelected ? '#4F46E5' : '#6366f1', opacity: isSelected ? 1 : 0.7 }} />
                  <Text className="text-[9px] text-neutral-500 dark:text-neutral-400 font-medium mt-1.5">{d.month}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Performance Metrics */}
        <View>
          <Text className="text-sm font-bold text-neutral-900 dark:text-white mb-2">Performance</Text>
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {/* Conversion Rate */}
            <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700 flex-row items-center" style={{ width: '48%', gap: 10 }}>
              <View className="relative items-center justify-center" style={{ width: 48, height: 48 }}>
                <View className="absolute w-12 h-12 rounded-full border-[5px] border-neutral-100 dark:border-neutral-700" />
                <View
                  className="absolute w-12 h-12 rounded-full border-[5px] border-indigo-600"
                  style={{ borderTopColor: 'transparent', borderRightColor: 'transparent', transform: [{ rotate: `${(performanceMetrics.conversionRate / 100) * 360}deg` }] }}
                />
                <Text className="text-[10px] font-bold text-neutral-900 dark:text-white">{performanceMetrics.conversionRate}%</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-neutral-900 dark:text-white">Conversion</Text>
                <Text className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">Quotes accepted</Text>
              </View>
            </View>

            {/* Avg Response Time */}
            <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700 flex-row items-center" style={{ width: '48%', gap: 10 }}>
              <View className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 items-center justify-center">
                <FontAwesome5 name="clock" size={16} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">{performanceMetrics.avgResponseTime}</Text>
                <Text className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">Avg. first reply</Text>
              </View>
            </View>

            {/* On-Time Rate */}
            <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700 flex-row items-center" style={{ width: '48%', gap: 10 }}>
              <View className="relative items-center justify-center" style={{ width: 48, height: 48 }}>
                <View className="absolute w-12 h-12 rounded-full border-[5px] border-neutral-100 dark:border-neutral-700" />
                <View
                  className="absolute w-12 h-12 rounded-full border-[5px] border-emerald-500"
                  style={{ borderTopColor: 'transparent', borderRightColor: 'transparent', transform: [{ rotate: `${(performanceMetrics.onTimeRate / 100) * 360}deg` }] }}
                />
                <Text className="text-[10px] font-bold text-neutral-900 dark:text-white">{performanceMetrics.onTimeRate}%</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-neutral-900 dark:text-white">On-Time Rate</Text>
                <Text className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">On schedule</Text>
              </View>
            </View>

            {/* Repeat Client Rate */}
            <View className="bg-white dark:bg-neutral-900 rounded-xl p-3.5 border border-neutral-100 dark:border-neutral-700 flex-row items-center" style={{ width: '48%', gap: 10 }}>
              <View className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 items-center justify-center">
                <FontAwesome5 name="redo" size={14} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">{performanceMetrics.repeatRate}%</Text>
                <Text className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5">Repeat bookings</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-100 dark:border-neutral-700">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-neutral-900 dark:text-white">Recent Activity</Text>
            <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{recentActivity.length} events</Text>
          </View>
          <View>
            {recentActivity.map((item: any, index: number) => (
              <View key={item.id} className="flex-row" style={{ gap: 10 }}>
                <View className="items-center">
                  <View className={`w-7 h-7 rounded-full items-center justify-center ${item.colorClass} dark:bg-neutral-800`}>
                    <FontAwesome5 name={item.icon} size={10} color={item.iconColor} />
                  </View>
                  {index < recentActivity.length - 1 && (
                    <View className="w-px flex-1 bg-neutral-100 dark:bg-neutral-700 mt-1" />
                  )}
                </View>
                <View className="pb-3 flex-1">
                  <Text className="text-xs font-semibold text-neutral-900 dark:text-white">{item.title}</Text>
                  <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={2}>{item.description}</Text>
                  <Text className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-0.5">{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Revenue by Service */}
        <View className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-100 dark:border-neutral-700">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-neutral-900 dark:text-white">Revenue by Service</Text>
            <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">${(totalServiceRevenue / 1000).toFixed(1)}k total</Text>
          </View>
          <View style={{ gap: 10 }}>
            {serviceBreakdown.map((service: any) => {
              const pct = totalServiceRevenue > 0 ? Math.round((service.amount / totalServiceRevenue) * 100) : 0;
              return (
                <View key={service.name}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1" numberOfLines={1}>{service.name}</Text>
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-xs font-bold text-neutral-900 dark:text-white">${(service.amount / 1000).toFixed(1)}k</Text>
                      <Text className="text-[9px] text-neutral-400 dark:text-neutral-500 w-7 text-right">{pct}%</Text>
                    </View>
                  </View>
                  <View className="w-full bg-neutral-100 dark:bg-neutral-700 rounded-full h-1.5">
                    <View className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: service.color }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top Clients */}
        <View className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-100 dark:border-neutral-700">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-neutral-900 dark:text-white">Top Clients</Text>
            <FontAwesome5 name="users" size={12} color={isDark ? "#737373" : "#a3a3a3"} />
          </View>
          <View style={{ gap: 10 }}>
            {topClients.map((client: any, i: number) => (
              <View key={client.name} className="flex-row items-center" style={{ gap: 10 }}>
                <Text className="text-lg">{client.avatar}</Text>
                <View className="flex-1">
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Text className="text-xs font-bold text-neutral-900 dark:text-white" numberOfLines={1}>{client.name}</Text>
                    {i === 0 && topClients.length > 1 && (
                      <View className="bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                        <Text className="text-[8px] font-bold text-amber-700 dark:text-amber-400">#1</Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                    <Text className="text-[10px] text-neutral-500 dark:text-neutral-400">{client.jobs} jobs</Text>
                    <Text className="text-neutral-300 dark:text-neutral-600">·</Text>
                    <Text className="text-[10px] text-neutral-500 dark:text-neutral-400">Last: {client.lastProject}</Text>
                  </View>
                </View>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">${(client.total / 1000).toFixed(1)}k</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        {onViewAllJobs && (
          <View className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-100 dark:border-neutral-700">
            <Text className="text-sm font-bold text-neutral-900 dark:text-white mb-3">Quick Actions</Text>
            <TouchableOpacity 
              onPress={onViewAllJobs} 
              className="w-full flex-row items-center justify-center bg-indigo-600 dark:bg-indigo-500 rounded-xl py-3" 
              style={{ gap: 8 }}
            >
              <FontAwesome5 name="briefcase" size={13} color="#fff" />
              <Text className="text-sm font-semibold text-white">View All Jobs</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </ScrollView>
  );
}
