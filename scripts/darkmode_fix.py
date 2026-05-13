import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    content = content.replace('text-neutral-900 underline', 'text-neutral-900 dark:text-neutral-100 underline')
    content = content.replace('isDark ? "#666" : "#a3a3a3"', 'isDark ? "#9ca3af" : "#a3a3a3"')
    content = content.replace('className="text-xs font-semibold text-neutral-500"', 'className="text-xs font-semibold text-neutral-500 dark:text-neutral-300"')
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")

for f in glob.glob('src/screens/*.js'):
    fix_file(f)
for f in glob.glob('src/screens/*.tsx'):
    fix_file(f)
