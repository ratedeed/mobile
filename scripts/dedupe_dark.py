#!/usr/bin/env python3
"""Remove duplicate dark: classes"""
import re
import sys

for filepath in sys.argv[1:]:
    with open(filepath, "r") as f:
        content = f.read()
    
    # Remove duplicate dark: classes, keeping the first occurrence
    def dedupe_dark(match):
        classes = match.group(1)
        seen = set()
        result = []
        for c in classes.split():
            if c.startswith('dark:'):
                if c in seen:
                    continue
                seen.add(c)
            result.append(c)
        return f'className="{" ".join(result)}"'
    
    content = re.sub(r'className="([^"]*)"', dedupe_dark, content)
    
    with open(filepath, "w") as f:
        f.write(content)
    
    print(f"Cleaned: {filepath}")
