import re
with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
with open('chinese_matches.txt', 'w', encoding='utf-8') as out:
    for i, line in enumerate(lines):
        if re.search(r'[\u4e00-\u9fa5]', line):
            if 150 < i < 600: continue # Skip the top dictionaries
            if 'language === \'zh\'' in line: continue # Skip conditional rendering
            if 'language === "zh"' in line: continue
            out.write(f'{i+1}: {line.strip()}\n')
