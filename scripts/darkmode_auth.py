#!/usr/bin/env python3
"""Add dark mode to auth screens"""
import re
import os

base = "/Users/tamim/Desktop/ratedeedmobile/src/screens"

def add_dark(text, light_class, dark_class):
    pattern = rf'(?<![a-zA-Z0-9-]){re.escape(light_class)}(?![a-zA-Z0-9-])'
    def repl(m):
        return f'{light_class} {dark_class}'
    return re.sub(pattern, repl, text)

def process_js_file(filepath):
    with open(filepath, "r") as f:
        content = f.read()
    
    filename = os.path.basename(filepath)
    
    # Add useColorScheme import if not present
    if 'useColorScheme' not in content:
        content = content.replace(
            "from 'react-native';",
            "from 'react-native';\nimport { useColorScheme } from 'react-native';"
        )
    
    # Add isDark declaration - find function component
    if 'isDark' not in content:
        # Look for const Component = () => {
        pattern = r'(const \w+ = \(\) => \{)\n'
        match = re.search(pattern, content)
        if match:
            insert_pos = match.end()
            content = content[:insert_pos] + "  const isDark = useColorScheme() === 'dark';\n" + content[insert_pos:]
    
    # Backgrounds
    content = add_dark(content, 'bg-white', 'dark:bg-neutral-950')
    content = add_dark(content, 'bg-neutral-50', 'dark:bg-neutral-900')
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
    
    # Hardcoded colors - only if isDark is available
    if 'isDark' in content:
        content = content.replace('color="#737373"', 'color={isDark ? "#a3a3a3" : "#737373"}')
        content = content.replace('color="#525252"', 'color={isDark ? "#d4d4d4" : "#525252"}')
        content = content.replace('color="#171717"', 'color={isDark ? "#ffffff" : "#171717"}')
        content = content.replace('color="#404040"', 'color={isDark ? "#a3a3a3" : "#404040"}')
        content = content.replace('color="#262626"', 'color={isDark ? "#d4d4d4" : "#262626"}')
        content = content.replace('color="#A3A3A3"', 'color={isDark ? "#737373" : "#A3A3A3"}')
        content = content.replace('color="#a3a3a3"', 'color={isDark ? "#737373" : "#a3a3a3"}')
    
    # Input placeholder colors
    content = content.replace('placeholderTextColor="#a3a3a3"', 'placeholderTextColor={isDark ? "#666" : "#a3a3a3"}')
    
    with open(filepath, "w") as f:
        f.write(content)
    
    print(f"Done: {filename}")

process_js_file(f"{base}/LoginScreen.js")
process_js_file(f"{base}/RegisterScreen.js")
process_js_file(f"{base}/ContractorSignupScreen.js")

# ResetPasswordScreen.tsx
filepath = f"{base}/ResetPasswordScreen.tsx"
with open(filepath, "r") as f:
    content = f.read()

if 'useColorScheme' not in content:
    content = content.replace(
        "from 'react-native';",
        "from 'react-native';\nimport { useColorScheme } from 'react-native';"
    )

if 'isDark' not in content:
    content = content.replace(
        "export default function ResetPasswordScreen() {\n  const navigation = useNavigation();",
        "export default function ResetPasswordScreen() {\n  const isDark = useColorScheme() === 'dark';\n  const navigation = useNavigation();"
    )

content = add_dark(content, 'bg-white', 'dark:bg-neutral-950')
content = add_dark(content, 'bg-neutral-50', 'dark:bg-neutral-900')
content = add_dark(content, 'bg-neutral-100', 'dark:bg-neutral-800')
content = add_dark(content, 'text-neutral-900', 'dark:text-white')
content = add_dark(content, 'text-neutral-800', 'dark:text-neutral-100')
content = add_dark(content, 'text-neutral-700', 'dark:text-neutral-300')
content = add_dark(content, 'text-neutral-600', 'dark:text-neutral-300')
content = add_dark(content, 'text-neutral-500', 'dark:text-neutral-400')
content = add_dark(content, 'text-neutral-400', 'dark:text-neutral-500')
content = add_dark(content, 'border-neutral-200', 'dark:border-neutral-700')
content = add_dark(content, 'border-neutral-100', 'dark:border-neutral-800')
content = add_dark(content, 'border-neutral-300', 'dark:border-neutral-600')

content = content.replace('color="#737373"', 'color={isDark ? "#a3a3a3" : "#737373"}')
content = content.replace('color="#525252"', 'color={isDark ? "#d4d4d4" : "#525252"}')
content = content.replace('color="#171717"', 'color={isDark ? "#ffffff" : "#171717"}')
content = content.replace('color="#a3a3a3"', 'color={isDark ? "#737373" : "#a3a3a3"}')
content = content.replace('placeholderTextColor="#a3a3a3"', 'placeholderTextColor={isDark ? "#666" : "#a3a3a3"}')

with open(filepath, "w") as f:
    f.write(content)

print("Done: ResetPasswordScreen.tsx")
