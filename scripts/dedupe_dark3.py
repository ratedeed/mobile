#!/usr/bin/env python3
"""Remove duplicate dark: classes, keeping only the last one per base class"""
import re
import sys

def dedupe_dark_classes(text):
    """For each base class, keep only the last dark: variant"""
    classes = text.split()
    # Track dark classes by their base (e.g., dark:bg-neutral-950 -> bg)
    dark_map = {}  # base -> (index, full_class)
    result = []
    for i, c in enumerate(classes):
        if c.startswith('dark:'):
            # Extract base class name (e.g., dark:bg-neutral-950 -> bg)
            parts = c[5:].split('-')
            # Base is the first part(s) before color/size modifiers
            base = parts[0]
            dark_map[base] = (i, c)
        else:
            result.append(c)
    
    # Add back only the last dark variant for each base
    for base, (idx, c) in dark_map.items():
        result.append(c)
    
    return ' '.join(result)

for filepath in sys.argv[1:]:
    with open(filepath, "r") as f:
        content = f.read()
    
    def dedupe(match):
        full = match.group(1)
        return 'className="' + dedupe_dark_classes(full) + '"'
    
    content = re.sub(r'className="([^"]*)"', dedupe, content)
    
    def dedupe_backtick(match):
        full = match.group(1)
        return 'className={`' + dedupe_dark_classes(full) + '`}'
    
    content = re.sub(r'className=\{`([^`]*)`\}', dedupe_backtick, content)
    
    # Also handle inline template strings like 'text-neutral-900 dark:text-white dark:text-neutral-50'
    def dedupe_inline(match):
        full = match.group(1)
        return "'" + dedupe_dark_classes(full) + "'"
    
    content = re.sub(r"'([^']*dark:[^']*)'", dedupe_inline, content)
    
    with open(filepath, "w") as f:
        f.write(content)
    
    print(f"Cleaned: {filepath}")
