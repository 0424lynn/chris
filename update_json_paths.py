#!/usr/bin/env python3
"""
Update all image references in JSON files to use new subdirectory paths.
"""

import os
import glob

BASE_DIR = r"C:\Users\jeffy\chris\yang-v2"

# Build mapping: filename -> new path (always use forward slashes for JSON values)
products_files = os.listdir(os.path.join(BASE_DIR, "images", "products"))
wiring_files = os.listdir(os.path.join(BASE_DIR, "images", "wiring"))
repair_files = os.listdir(os.path.join(BASE_DIR, "images", "repair"))

file_to_newpath = {}
for f in products_files:
    file_to_newpath[f] = "images/products/" + f
for f in wiring_files:
    file_to_newpath[f] = "images/wiring/" + f
for f in repair_files:
    file_to_newpath[f] = "images/repair/" + f

print(f"Total files to remap: {len(file_to_newpath)}")

def url_encode_spaces(s):
    return s.replace(" ", "%20")

def make_replacements_for_file(filename, new_path):
    """Return list of (old_string, new_string) pairs for this file."""
    pairs = []
    # 1. bare filename in quotes (used in "image" and "diagram" fields)
    #    e.g. "image": "AGR10BP.png"  ->  "image": "images/products/AGR10BP.png"
    pairs.append((f'"{filename}"', f'"{new_path}"'))

    # 2. ./filename style (used in img src attributes)
    #    e.g. src='./AGR10BP.png'  ->  src='images/products/AGR10BP.png'
    pairs.append((f'./{filename}', new_path))

    # 3. URL-encoded version with spaces -> %20
    if " " in filename:
        encoded_old = url_encode_spaces(filename)
        encoded_new = url_encode_spaces(new_path)
        # bare encoded in quotes
        pairs.append((f'"{encoded_old}"', f'"{encoded_new}"'))
        # ./encoded
        pairs.append((f'./{encoded_old}', encoded_new))

    return pairs

json_files = glob.glob(os.path.join(BASE_DIR, "*.json"))
# exclude package.json and package-lock.json
json_files = [f for f in json_files if not os.path.basename(f).startswith("package")]

print(f"JSON files to update: {len(json_files)}")
print()

updated_files = []

for json_path in sorted(json_files):
    with open(json_path, "r", encoding="utf-8") as fh:
        content = fh.read()

    original = content
    changes = 0

    # Sort by descending filename length to avoid substring replacement issues
    for filename, new_path in sorted(file_to_newpath.items(), key=lambda x: -len(x[0])):
        for old_str, new_str in make_replacements_for_file(filename, new_path):
            if old_str in content:
                count = content.count(old_str)
                content = content.replace(old_str, new_str)
                changes += count

    if content != original:
        with open(json_path, "w", encoding="utf-8") as fh:
            fh.write(content)
        updated_files.append((os.path.basename(json_path), changes))
        print(f"Updated: {os.path.basename(json_path)} ({changes} replacements)")
    else:
        print(f"No changes: {os.path.basename(json_path)}")

print()
print(f"Summary: {len(updated_files)} files updated")
for fname, count in updated_files:
    print(f"  {fname}: {count} replacements")
