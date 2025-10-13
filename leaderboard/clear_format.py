#!/usr/bin/env python3
import json
import sys

if len(sys.argv) < 2:
    print("Usage: python3 clear_format.py gen1ou|gen9ou|both")
    sys.exit(1)

format_to_clear = sys.argv[1].lower()

with open('track1_qualifying.json', 'r') as f:
    data = json.load(f)

if format_to_clear == 'both':
    data['formats']['gen1ou'] = []
    data['formats']['gen9ou'] = []
    data['qualifying_status']['gen1ou']['active'] = False
    data['qualifying_status']['gen9ou']['active'] = False
    print("✅ Cleared both formats")
elif format_to_clear in ['gen1ou', 'gen9ou']:
    data['formats'][format_to_clear] = []
    data['qualifying_status'][format_to_clear]['active'] = False
    print(f"✅ Cleared {format_to_clear}")
else:
    print("Invalid format. Use: gen1ou, gen9ou, or both")
    sys.exit(1)

with open('track1_qualifying.json', 'w') as f:
    json.dump(data, f, indent=2)
