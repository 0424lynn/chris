import glob, re, os

base = r"C:\Users\jeffy\chris\yang-v2"
json_files = [f for f in glob.glob(os.path.join(base, "*.json"))
              if not os.path.basename(f).startswith("package")]

pattern = re.compile(r"images/(products|wiring|repair)/([^\s\"']+\.(png|jpg|jpeg))", re.IGNORECASE)

broken = set()
ok = set()
for jf in json_files:
    with open(jf, encoding="utf-8") as fh:
        content = fh.read()
    for m in pattern.finditer(content):
        rel_path = m.group(0)
        full_path = os.path.join(base, rel_path.replace("/", os.sep))
        if os.path.exists(full_path):
            ok.add(rel_path)
        else:
            broken.add((os.path.basename(jf), rel_path))

print(f"Valid paths referenced: {len(ok)}")
print(f"Broken paths referenced: {len(broken)}")
for jf, path in sorted(broken):
    print(f"  BROKEN in {jf}: {path}")
