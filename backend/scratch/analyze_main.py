import glob
import re

files = glob.glob("c:/Users/prabh/OneDrive/Desktop/NEW_shift_management/backend/**/*.py", recursive=True)
for f_path in files:
    with open(f_path, "r", encoding="utf-8") as f:
        try:
            content = f.read()
            imports = re.findall(r'(?:from|import)\s+fastapi\S*', content)
            if imports:
                print(f"File: {f_path}")
                for imp in re.findall(r'.*fastapi.*', content):
                    print(f"  {imp}")
        except Exception:
            pass
