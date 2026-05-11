import re

def check_brackets(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
        
    stack = []
    line_num = 1
    for char in text:
        if char == '\n':
            line_num += 1
        elif char in '({[':
            stack.append((char, line_num))
        elif char in ')}]':
            if not stack:
                print(f"Unmatched {char} at line {line_num}")
                return
            top, _ = stack.pop()
            if (top == '(' and char != ')') or \
               (top == '{' and char != '}') or \
               (top == '[' and char != ']'):
                print(f"Mismatched {top} and {char} at line {line_num}")
                return
                
    if stack:
        print(f"Unclosed {stack[-1][0]} from line {stack[-1][1]}")
    else:
        print("Brackets are perfectly matched!")

check_brackets('temp.jsx')