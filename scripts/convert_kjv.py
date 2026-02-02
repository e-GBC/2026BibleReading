import json
import os

# Paths
INPUT_FILE = r'c:\Antigravity\000.Practice\012.BibleReading\data\kjv.json'
OUTPUT_FILE = r'c:\Antigravity\000.Practice\012.BibleReading\data\bible_en.js'

def convert():
    print(f"Reading {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'verses' not in data:
        print("Error: 'verses' key not found in JSON.")
        return

    verses = data['verses']
    print(f"Found {len(verses)} verses.")

    # We want to format as: "BookNameChapter:Verse Text"
    # Example: "Genesis1:1 In the beginning..."
    # Note: bible.js uses "創1:1 ...". There is no space between Book and Chapter.
    
    js_lines = []
    js_lines.append('var profiles_en = new Array(')

    for v in verses:
        # kjv.json structure: {"book_name": "Genesis", "chapter": 1, "verse": 1, "text": "In the beginning..."}
        b_name = v['book_name']
        chapter = v['chapter']
        verse = v['verse']
        text = v['text']
        
        # Clean up text? 
        # The source text has paragraph markers (¶) and brackets ([]). 
        # User usually wants clean text, but requested "format of previous doc".
        # Let's clean standard specialized markers if possible or keep raw?
        # Current Chinese text "起初，神創造..." is clean.
        # KJV text: "¶ In the beginning..."
        # I'll remove the pilcrow (¶) as it's cleaner for display.
        
        clean_text = text.replace('¶ ', '').replace('¶', '')
        
        # Format string
        # Escape quotes in text?
        clean_text = clean_text.replace('"', '\\"')
        
        entry = f'"{b_name}{chapter}:{verse} {clean_text}"'
        js_lines.append(f'{entry},')

    # Remove trailing comma on last item if valid JSON array (but this is JS array)
    # JS array allows trailing comma mostly, but safer to remove.
    if js_lines[-1].endswith(','):
        js_lines[-1] = js_lines[-1][:-1]

    js_lines.append(');')

    print(f"Writing {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(js_lines))
    
    print("Done.")

if __name__ == '__main__':
    convert()
