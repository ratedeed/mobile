#!/usr/bin/env python3
"""Add dark mode support to ContractorDashboardScreen.tsx"""
import re

filepath = "/Users/tamim/Desktop/ratedeedmobile/src/screens/ContractorDashboardScreen.tsx"
with open(filepath, "r") as f:
    content = f.read()

# 1. Add useColorScheme import
content = content.replace(
    "import React, { useState, useEffect, useCallback, useRef } from 'react';",
    "import React, { useState, useEffect, useCallback, useRef } from 'react';\nimport { useColorScheme } from 'react-native';"
)

# 2. Update StatusBadge config with dark variants
old_status = """  const config: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-800' },
    accepted: { label: 'Accepted', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    rejected: { label: 'Rejected', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    funded_in_progress: { label: 'In Progress', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    awaiting_payment: { label: 'Awaiting Payment', bg: 'bg-amber-100', text: 'text-amber-800' },
    completed_pending_release: { label: 'Pending Release', bg: 'bg-blue-100', text: 'text-blue-800' },
    completed_paid: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    disputed: { label: 'Disputed', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  };
  const c = config[status] || { label: status, bg: 'bg-neutral-100', text: 'text-neutral-800' };"""

new_status = """  const config: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: 'Pending', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300' },
    accepted: { label: 'Accepted', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300' },
    rejected: { label: 'Rejected', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-300' },
    funded_in_progress: { label: 'In Progress', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-300' },
    awaiting_payment: { label: 'Awaiting Payment', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300' },
    completed_pending_release: { label: 'Pending Release', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300' },
    completed_paid: { label: 'Completed', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300' },
    disputed: { label: 'Disputed', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-300' },
  };
  const c = config[status] || { label: status, bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-300' };"""

content = content.replace(old_status, new_status)

# 3. Update EmptyState
old_empty = '''    <View className="bg-white rounded-xl border border-neutral-200 p-8 items-center">
      <FontAwesome5 name={iconName[icon] || icon} size={32} color="#d4d4d4" />
      <Text className="text-sm font-semibold text-neutral-600 mt-3">{title}</Text>
      <Text className="text-xs text-neutral-400 mt-1 text-center">{message}</Text>
    </View>'''

new_empty = '''    <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 items-center">
      <FontAwesome5 name={iconName[icon] || icon} size={32} color="#d4d4d4" />
      <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mt-3">{title}</Text>
      <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 text-center">{message}</Text>
    </View>'''

content = content.replace(old_empty, new_empty)

# 4. Update Sheet component
old_sheet = '''        <View className="bg-white rounded-t-2xl max-h-[85vh]">
          <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto mt-3" />
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-neutral-100">
            <Text className="text-lg font-bold text-neutral-900">{title}</Text>
            <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full">
              <FontAwesome5 name="times" size={16} color="#737373" />'''

new_sheet = '''        <View className="bg-white dark:bg-neutral-800 rounded-t-2xl max-h-[85vh]">
          <View className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-500 mx-auto mt-3" />
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-neutral-100 dark:border-neutral-700">
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">{title}</Text>
            <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full">
              <FontAwesome5 name="times" size={16} color={isDark ? "#a3a3a3" : "#737373"} />'''

content = content.replace(old_sheet, new_sheet)

# 5. Add isDark declaration in main component
old_main_start = "const ContractorDashboardScreen: React.FC = () => {\n  const navigation = useNavigation<any>();\n  const { userId: currentUserId, updateUser } = useAuth();"
new_main_start = "const ContractorDashboardScreen: React.FC = () => {\n  const navigation = useNavigation<any>();\n  const { userId: currentUserId, updateUser } = useAuth();\n  const colorScheme = useColorScheme();\n  const isDark = colorScheme === 'dark';"

content = content.replace(old_main_start, new_main_start)

# 6. Bulk Tailwind replacements (avoid double-applying by checking no existing dark:)
# Use regex with negative lookbehind/lookahead

def add_dark(text, light_class, dark_class):
    """Add dark variant to a Tailwind class if not already present"""
    pattern = rf'(?<![a-zA-Z0-9-]){re.escape(light_class)}(?![a-zA-Z0-9-])'
    def repl(m):
        return f'{light_class} {dark_class}'
    return re.sub(pattern, repl, text)

# Backgrounds
content = add_dark(content, 'bg-white', 'dark:bg-neutral-900')
content = add_dark(content, 'bg-neutral-50', 'dark:bg-neutral-800')
content = add_dark(content, 'bg-neutral-100', 'dark:bg-neutral-800')

# Text colors
content = add_dark(content, 'text-neutral-900', 'dark:text-white')
content = add_dark(content, 'text-neutral-800', 'dark:text-neutral-100')
content = add_dark(content, 'text-neutral-700', 'dark:text-neutral-300')
content = add_dark(content, 'text-neutral-600', 'dark:text-neutral-300')
content = add_dark(content, 'text-neutral-500', 'dark:text-neutral-400')
content = add_dark(content, 'text-neutral-400', 'dark:text-neutral-500')

# Borders
content = add_dark(content, 'border-neutral-200', 'dark:border-neutral-700')
content = add_dark(content, 'border-neutral-100', 'dark:border-neutral-800')
content = add_dark(content, 'border-neutral-300', 'dark:border-neutral-600')

# Fix Sheet's bg-white that should be dark:bg-neutral-800 (not 900)
content = content.replace('bg-white dark:bg-neutral-900 rounded-t-2xl', 'bg-white dark:bg-neutral-800 rounded-t-2xl')

# 7. Hardcoded color fixes
content = content.replace('color="#737373"', 'color={isDark ? "#a3a3a3" : "#737373"}')
content = content.replace('color="#525252"', 'color={isDark ? "#d4d4d4" : "#525252"}')
content = content.replace('color="#171717"', 'color={isDark ? "#ffffff" : "#171717"}')
content = content.replace('color="#9CA3AF"', 'color={isDark ? "#6b7280" : "#9CA3AF"}')
content = content.replace('color="#404040"', 'color={isDark ? "#a3a3a3" : "#404040"}')
content = content.replace('color="#262626"', 'color={isDark ? "#d4d4d4" : "#262626"}')
content = content.replace('color="#A3A3A3"', 'color={isDark ? "#737373" : "#A3A3A3"}')

with open(filepath, "w") as f:
    f.write(content)

print("Done! Dark mode added to ContractorDashboardScreen.tsx")
