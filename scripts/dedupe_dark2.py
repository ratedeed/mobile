#!/usr/bin/env python3
"""Remove duplicate dark: classes from className attributes"""
import re
import sys

for filepath in sys.argv[1:]:
    with open(filepath, "r") as f:
        content = f.read()
    
    def dedupe(match):
        full = match.group(1)
        classes = full.split()
        seen_dark = set()
        result = []
        for c in classes:
            if c.startswith('dark:'):
                if c in seen_dark:
                    continue
                seen_dark.add(c)
            result.append(c)
        return 'className="' + ' '.join(result) + '"'
    
    # Handle className="..." and className={`...`}
    content = re.sub(r'className="([^"]*)"', dedupe, content)
    
    # Handle template literals: className={`...`}
    def dedupe_backtick(match):
        full = match.group(1)
        classes = full.split()
        seen_dark = set()
        result = []
        for c in classes:
            if c.startswith('dark:'):
                if c in seen_dark:
                    continue
                seen_dark.add(c)
            result.append(c)
        return 'className={`' + ' '.join(result) + '`}'
    
    content = re.sub(r'className=\{`([^`]*)`\}', dedupe_backtick, content)
    
    with open(filepath, "w") as f:
        f.write(content)
    
    print(f"Cleaned: {filepath}")
