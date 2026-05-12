#!/usr/bin/env python3
"""Add dark mode to EarningsScreen, DisputeScreen, NotificationsScreen"""
import re
import os

base = "/Users/tamim/Desktop/ratedeedmobile/src/screens"

def add_dark(text, light_class, dark_class):
    pattern = rf'(?<![a-zA-Z0-9-]){re.escape(light_class)}(?![a-zA-Z0-9-])'
    def repl(m):
        return f'{light_class} {dark_class}'
    return re.sub(pattern, repl, text)

def process_file(filepath, is_tsx=True):
    with open(filepath, "r") as f:
        content = f.read()
    
    filename = os.path.basename(filepath)
    
    # Add useColorScheme import if not present
    if 'useColorScheme' not in content:
        if 'from \'react-native\';' in content:
            content = content.replace(
                'from \'react-native\';',
                'from \'react-native\';\nimport { useColorScheme } from \'react-native\';'
            )
        elif 'from "react-native";' in content:
            content = content.replace(
                'from "react-native";',
                'from "react-native";\nimport { useColorScheme } from "react-native";'
            )
    
    # Add isDark declaration - find the function component declaration
    if 'isDark' not in content:
        # Look for export default function or const X = () =>
        patterns = [
            r'(export default function \w+\([^)]*\) \{)\n',
            r'(const \w+:\s*React\.FC[^=]*=\s*\(\)\s*=>\s*\{)\n',
            r'(const \w+\s*=\s*\(\)\s*=>\s*\{)\n',
        ]
        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                insert_pos = match.end()
                content = content[:insert_pos] + "  const isDark = useColorScheme() === 'dark';\n" + content[insert_pos:]
                break
    
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
    
    # Fix modal/sheet bg-white that should be neutral-800
    content = content.replace('bg-white dark:bg-neutral-900 rounded-t-2xl', 'bg-white dark:bg-neutral-800 rounded-t-2xl')
    content = content.replace('bg-white dark:bg-neutral-900 rounded-xl', 'bg-white dark:bg-neutral-800 rounded-xl')
    
    # Color-specific sections
    content = content.replace('bg-red-50', 'bg-red-50 dark:bg-red-900/20')
    content = content.replace('bg-emerald-50', 'bg-emerald-50 dark:bg-emerald-900/20')
    content = content.replace('bg-amber-50', 'bg-amber-50 dark:bg-amber-900/20')
    content = content.replace('bg-blue-50', 'bg-blue-50 dark:bg-blue-900/20')
    content = content.replace('bg-indigo-50', 'bg-indigo-50 dark:bg-indigo-900/20')
    
    content = content.replace('text-red-800', 'text-red-800 dark:text-red-300')
    content = content.replace('text-red-700', 'text-red-700 dark:text-red-300')
    content = content.replace('text-red-600', 'text-red-600 dark:text-red-300')
    
    content = content.replace('text-emerald-800', 'text-emerald-800 dark:text-emerald-300')
    content = content.replace('text-emerald-700', 'text-emerald-700 dark:text-emerald-300')
    content = content.replace('text-emerald-600', 'text-emerald-600 dark:text-emerald-300')
    
    content = content.replace('text-amber-800', 'text-amber-800 dark:text-amber-300')
    content = content.replace('text-amber-700', 'text-amber-700 dark:text-amber-300')
    content = content.replace('text-amber-600', 'text-amber-600 dark:text-amber-300')
    
    content = content.replace('text-blue-800', 'text-blue-800 dark:text-blue-300')
    content = content.replace('text-blue-700', 'text-blue-700 dark:text-blue-300')
    content = content.replace('text-blue-600', 'text-blue-600 dark:text-blue-300')
    
    content = content.replace('text-indigo-800', 'text-indigo-800 dark:text-indigo-300')
    content = content.replace('text-indigo-700', 'text-indigo-700 dark:text-indigo-300')
    content = content.replace('text-indigo-600', 'text-indigo-600 dark:text-indigo-300')
    
    content = content.replace('border-red-100', 'border-red-100 dark:border-red-800')
    content = content.replace('border-red-200', 'border-red-200 dark:border-red-800')
    content = content.replace('border-emerald-100', 'border-emerald-100 dark:border-emerald-800')
    content = content.replace('border-emerald-200', 'border-emerald-200 dark:border-emerald-800')
    content = content.replace('border-amber-100', 'border-amber-100 dark:border-amber-800')
    content = content.replace('border-blue-100', 'border-blue-100 dark:border-blue-800')
    
    # Hardcoded colors - only if isDark is available
    if 'isDark' in content:
        content = content.replace('color="#737373"', 'color={isDark ? "#a3a3a3" : "#737373"}')
        content = content.replace('color="#525252"', 'color={isDark ? "#d4d4d4" : "#525252"}')
        content = content.replace('color="#171717"', 'color={isDark ? "#ffffff" : "#171717"}')
        content = content.replace('color="#404040"', 'color={isDark ? "#a3a3a3" : "#404040"}')
        content = content.replace('color="#262626"', 'color={isDark ? "#d4d4d4" : "#262626"}')
    
    with open(filepath, "w") as f:
        f.write(content)
    
    print(f"Done: {filename}")

process_file(f"{base}/EarningsScreen.tsx")
process_file(f"{base}/DisputeScreen.tsx")
process_file(f"{base}/NotificationsScreen.tsx")
