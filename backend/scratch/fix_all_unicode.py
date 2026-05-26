import os, sys

# Files to fix
files = [
    'main.py',
    'app/services/ai_scheduler.py',
    'app/services/excel_upload_manager.py',
    'app/routes/activity_routes.py',
    'app/middleware/activity_middleware.py',
    'app/utils/activity_logger.py',
]

replacements = [
    ('\u2713', '[OK]'),
    ('\u2717', '[ERR]'),
    ('\U0001f4ca', '[STATS]'),
    ('\u26a0\ufe0f', '[WARN]'),
    ('\u26a0', '[WARN]'),
    ('\u274c', '[FAIL]'),
    ('\u2705', '[PASS]'),
    ('\u2714', '[OK]'),
    ('\U0001f680', '[RUN]'),
    ('\U0001f4c5', '[DATE]'),
    ('\U0001f504', '[SPIN]'),
    ('\u26a1', '[ZAP]'),
    ('\U0001f9e0', '[AI]'),
    ('\U0001f4be', '[SAVE]'),
    ('\U0001f4dd', '[NOTE]'),
    ('\U0001f525', '[FIRE]'),
    ('\U0001f44d', '[OK]'),
    ('\u2728', '[STAR]'),
    ('\u2714\ufe0f', '[OK]'),
    ('\u2139\ufe0f', '[INFO]'),
    ('\U0001f4a1', '[TIP]'),
    ('\U0001f4e6', '[PKG]'),
    ('\U0001f3af', '[AIM]'),
    ('\u2022', '-'),
    ('\U0001f4af', '[100]'),
    ('\U0001f916', '[BOT]'),
    ('\u23f0', '[TIME]'),
    ('\U0001f4f1', '[MSG]'),
    ('\U0001f511', '[KEY]'),
    ('\U0001f512', '[LOCK]'),
    ('\U0001f513', '[OPEN]'),
    ('\u2764', '[HEART]'),
    ('\U0001f50d', '[SRCH]'),
    ('\U0001f9f9', '[CLEAN]'),
    ('\U0001f4cb', '[LIST]'),
    ('\U0001f4c4', '[FILE]'),
    ('\U0001f4c8', '[CHART]'),
    ('\U0001f4c9', '[DOWN]'),
    ('\U0001f4cc', '[PIN]'),
    ('\U0001f194', '[ID]'),
    ('\U0001f5d3', '[CAL]'),
    ('\U0001f4aa', '[STR]'),
    ('\U0001f6ab', '[BLK]'),
    ('\u2193', 'v'),
    ('\u2191', '^'),
    ('\u2192', '->'),
    ('\u2190', '<-'),
]

total_changed = 0
for filepath in files:
    if not os.path.exists(filepath):
        print(f'SKIP (not found): {filepath}')
        continue
    content = open(filepath, encoding='utf-8').read()
    new_content = content
    file_changes = 0
    for uni, safe in replacements:
        if uni in new_content:
            count = new_content.count(uni)
            new_content = new_content.replace(uni, safe)
            file_changes += count
    if file_changes > 0:
        open(filepath, 'w', encoding='utf-8').write(new_content)
        print(f'Fixed {file_changes} chars in {filepath}')
        total_changed += file_changes
    else:
        print(f'Clean: {filepath}')

print(f'\nTotal replacements: {total_changed}')
