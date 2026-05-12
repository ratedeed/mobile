#!/usr/bin/env python3
"""Add dark mode support to QuoteReviewScreen.tsx"""
import re

filepath = "/Users/tamim/Desktop/ratedeedmobile/src/screens/QuoteReviewScreen.tsx"
with open(filepath, "r") as f:
    content = f.read()

# 1. Add useColorScheme import
content = content.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect } from 'react';\nimport { useColorScheme } from 'react-native';"
)

# 2. Add isDark declaration
old = "export default function QuoteReviewScreen() {\n  const navigation = useNavigation();"
new = "export default function QuoteReviewScreen() {\n  const colorScheme = useColorScheme();\n  const isDark = colorScheme === 'dark';\n  const navigation = useNavigation();"
content = content.replace(old, new)

# 3. Bulk Tailwind replacements
def add_dark(text, light_class, dark_class):
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

# Fix modal bg-white
content = content.replace('bg-white dark:bg-neutral-900 rounded-t-2xl p-6 w-full', 'bg-white dark:bg-neutral-800 rounded-t-2xl p-6 w-full')

# 4. Fix status badge conditional colors (lines 163-168 area)
# bg-amber-50 / text-amber-700 / bg-emerald-50 / text-emerald-700
content = content.replace("${isPending ? 'bg-amber-50' : 'bg-emerald-50'}",
                          "${isPending ? (isDark ? 'bg-amber-900/40' : 'bg-amber-50') : (isDark ? 'bg-emerald-900/40' : 'bg-emerald-50')}")
content = content.replace("color={isPending ? '#b45309' : '#059669'}",
                          "color={isPending ? (isDark ? '#fcd34d' : '#b45309') : (isDark ? '#6ee7b7' : '#059669')}")
content = content.replace("${isPending ? 'text-amber-700' : 'text-emerald-700'}",
                          "${isPending ? (isDark ? 'text-amber-300' : 'text-amber-700') : (isDark ? 'text-emerald-300' : 'text-emerald-700')}")

# 5. Fix emerald-specific sections
# Escrow notice bg/text
content = content.replace('bg-emerald-50 rounded-xl p-4 flex-row items-start border border-emerald-100',
                          'bg-emerald-50 dark:bg-emerald-900/40 rounded-xl p-4 flex-row items-start border border-emerald-100 dark:border-emerald-800')
content = content.replace('text-emerald-800', 'text-emerald-800 dark:text-emerald-300')
content = content.replace('text-emerald-700', 'text-emerald-700 dark:text-emerald-300')
content = content.replace('text-emerald-900', 'text-emerald-900 dark:text-emerald-200')

# Accepted banner
content = content.replace('bg-emerald-50 rounded-xl p-4 flex-row items-center border border-emerald-100',
                          'bg-emerald-50 dark:bg-emerald-900/40 rounded-xl p-4 flex-row items-center border border-emerald-100 dark:border-emerald-800')

# Indigo sections
content = content.replace('bg-indigo-50', 'bg-indigo-50 dark:bg-indigo-900/40')

# Red sections
content = content.replace('bg-red-50', 'bg-red-50 dark:bg-red-900/40')

# 6. Hardcoded colors
content = content.replace('color="#737373"', 'color={isDark ? "#a3a3a3" : "#737373"}')
content = content.replace('color="#a3a3a3"', 'color={isDark ? "#737373" : "#a3a3a3"}')

with open(filepath, "w") as f:
    f.write(content)

print("Done! Dark mode added to QuoteReviewScreen.tsx")
