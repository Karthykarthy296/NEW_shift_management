import re

content = open('main.py', encoding='utf-8').read()
lines = content.split('\n')

# Map of unicode chars used in print() calls to ASCII-safe replacements
replacements = [
    ('\u2713', '[OK]'),       # ✓
    ('\u2717', '[ERR]'),      # ✗
    ('\U0001f4ca', '[STATS]'), # 📊
    ('\u26a0', '[WARN]'),     # ⚠
    ('\u274c', '[FAIL]'),     # ❌
    ('\u2705', '[PASS]'),     # ✅
    ('\u2714', '[OK]'),       # ✔
    ('\U0001f680', '[RUN]'),  # 🚀
    ('\U0001f4c5', '[DATE]'), # 📅
    ('\U0001f504', '[SPIN]'), # 🔄
    ('\u26a1', '[ZAP]'),      # ⚡
    ('\U0001f9e0', '[AI]'),   # 🧠
    ('\U0001f4be', '[SAVE]'), # 💾
    ('\U0001f4dd', '[NOTE]'), # 📝
    ('\U0001f525', '[FIRE]'), # 🔥
    ('\U0001f44d', '[OK]'),   # 👍
]

new_lines = []
changed = 0
for lineno, line in enumerate(lines, 1):
    new_line = line
    # Only apply to lines with print statements or log calls
    if 'print(' in new_line or 'logger.' in new_line or 'logging.' in new_line:
        for uni, safe in replacements:
            if uni in new_line:
                new_line = new_line.replace(uni, safe)
                changed += 1
    new_lines.append(new_line)

new_content = '\n'.join(new_lines)
open('main.py', 'w', encoding='utf-8').write(new_content)
print(f"Done. Made {changed} replacements.")
