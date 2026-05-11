import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

js_match = re.search(r'<script type="text/babel">(.*?)</script>', content, re.DOTALL)
if js_match:
    with open('temp.jsx', 'w', encoding='utf-8') as out:
        out.write(js_match.group(1))
    print("Extracted to temp.jsx")
else:
    print("Not found")