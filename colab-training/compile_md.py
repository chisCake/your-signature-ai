"""
Этот скрипт создает md файл с кодом всех py файлов в TARGET_MODEL и в datasets.
(сугубо для удобства перекидывания кода какому-либо llm)
"""

import os

TARGET_MODEL = "nn/epsilon"

files = [
    os.path.join(TARGET_MODEL, file)
    for file in os.listdir(TARGET_MODEL)
    if file.endswith(".py")
]

files.extend(
    [
        os.path.join("datasets", file)
        for file in os.listdir("datasets")
        if file.endswith(".py")
    ]
)

content = f"# {TARGET_MODEL}\n\n"
for file in files:
    with open(file, "r", encoding="utf-8") as f:
        file_content = f.read()

        content += f"## {file}\n\n"
        content += f"```python\n{file_content}\n```\n\n"

with open(f"{TARGET_MODEL}.md", "w", encoding="utf-8") as f:
    f.write(content)
