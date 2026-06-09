import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/MapPanel.js', 'r', encoding='utf-8-sig') as f:
    content = f.read()

print("File length:", len(content))

# 1. Update imports
content = content.replace(
    "import { useState, useEffect, useRef } from 'react';",
    "import { useState, useEffect, useRef, useCallback } from 'react';"
)
print("OK: Updated imports")

# 2. Replace old type functions + DEFAULT_CENTER with POI_TYPES array
# The old section starts at "const DEFAULT_CENTER" and ends at "export default function MapPanel"
old_start_marker = "const DEFAULT_CENTER = { lat: 39.9042, lng: 116.4074, zoom: 15 };"
old_end_marker = "export default function MapPanel({ onBack, onAskGuide }) {"

# Build the new section
new_section = 'const DEFAULT_CENTER = { lat: 39.9042, lng: 116.4074, zoom: 15 };\n'
new_section += '\n'
new_section += 'const POI_TYPES = [\n'
new_section += "  { key: 'entrance',    label: '\U0001F6AA \u5165\u53E3',   icon: '\U0001F6AA', color: '#1677ff', defaultOn: true },\n"
new_section += "  { key: 'attraction',  label: '\U0001F3EF \u666F\u70B9',   icon: '\U0001F3EF', color: '#2B6C4E', defaultOn: true },\n"
new_section += "  { key: 'parking',     label: '\U0001F7FE \u505C\u8F66\u573A', icon: '\U0001F7FE', color: '#722ed1', defaultOn: true },\n"
new_section += "  { key: 'rest',        label: '\U0001F3E8 \u9152\u5E97',   icon: '\U0001F3E8', color: '#fa8c16', defaultOn: true },\n"
new_section += "  { key: 'restaurant',  label: '\U0001F37D\ufe0f \u9910\u5385',   icon: '\U0001F37D\ufe0f', color: '#eb2f96', defaultOn: true },\n"
new_section += '];\n'
new_section += '\n'
new_section += 'const typeConfigMap = Object.fromEntries(POI_TYPES.map(t => [t.key, t]));\n'
new_section += '\n'
new_section += 'export default function MapPanel({ onBack, onAskGuide }) {'

old_section_start = content.find(old_start_marker)
old_section_end = content.find(old_end_marker)
if old_section_start >= 0 and old_section_end >= 0:
    old_section_len = old_section_end + len(old_end_marker) - old_section_start
    old_section = content[old_section_start:old_section_start + old_section_len]
    content = content.replace(old_section, new_section, 1)
    print("OK: Replaced type functions with POI_TYPES")
else:
    print("FAIL: Could not find section boundaries")

# 3. Replace createDivIcon
start = content.find('function createDivIcon')
if start >= 0:
    end = content.find('function createClusterIcon')
    if end < 0:
        end = content.find('export default function MapPanel')
    old_div = content[start:end]
    
    new_div = 'function createDivIcon(type, highlighted) {\n'
    new_div += "  const cfg = typeConfigMap[type] || { icon: '\U0001F4CD', color: '#999' };\n"
    new_div += '  const sz = highlighted ? 36 : 28;\n'
    new_div += "  const bc = highlighted ? '#fff' : cfg.color;\n"
    new_div += '  return L.divIcon({\n'
    new_div += "    className: 'cm',\n"
    new_div += "    html: '<div style=\"width:' + sz + 'px;height:' + sz + 'px;background:' + cfg.color + ';border:2px solid ' + bc + ';border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:' + (highlighted ? 16 : 13) + 'px;box-shadow:0 2px 8px rgba(0,0,0,0.25)\">' + cfg.icon + '</div>',\n"
    new_div += '    iconSize: [sz, sz],\n'
    new_div += '    iconAnchor: [sz / 2, sz / 2],\n'
    new_div += '  });\n'
    new_div += '}\n'
    new_div += '\n'
    
    content = content.replace(old_div, new_div, 1)
    print("OK: Replaced createDivIcon")
else:
    print("FAIL: createDivIcon not found")

# 4. Update createClusterIcon to use typeConfigMap if applicable (keep as is for now)

with open('src/components/MapPanel.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Written OK")
