import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

content = open('main.py', encoding='utf-8').read()
lines = content.split('\n')

# Find the line number
start_line = None
for i, line in enumerate(lines):
    if '@reports_router.get("/dashboard-summary")' in line:
        start_line = i
        break

if start_line is None:
    print("NOT FOUND")
    sys.exit(1)

print(f"Found at line {start_line + 1}")

# Print 120 lines from that point
for i, line in enumerate(lines[start_line:start_line+120], start_line+1):
    print(f"{i:4}: {line}")
