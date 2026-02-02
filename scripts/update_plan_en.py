import json
import os

PLAN_FILE = r'c:\Antigravity\000.Practice\012.BibleReading\data\reading_plan.json'

# Chinese to English Book Name Mapping
BOOK_MAP = {
    "創世記": "Genesis", "出埃及記": "Exodus", "利未記": "Leviticus", "民數記": "Numbers", "申命記": "Deuteronomy",
    "約書亞記": "Joshua", "士師記": "Judges", "路得記": "Ruth", "撒母耳記上": "1 Samuel", "撒母耳記下": "2 Samuel",
    "列王紀上": "1 Kings", "列王紀下": "2 Kings", "歷代志上": "1 Chronicles", "歷代志下": "2 Chronicles",
    "以斯拉記": "Ezra", "尼希米記": "Nehemiah", "以斯帖記": "Esther", "約伯記": "Job", "詩篇": "Psalms",
    "箴言": "Proverbs", "傳道書": "Ecclesiastes", "雅歌": "Song of Solomon", "以賽亞書": "Isaiah",
    "耶利米書": "Jeremiah", "耶利米哀歌": "Lamentations", "以西結書": "Ezekiel", "但以理書": "Daniel",
    "何西阿書": "Hosea", "約珥書": "Joel", "阿摩司書": "Amos", "俄巴底亞書": "Obadiah", "約拿書": "Jonah",
    "彌迦書": "Micah", "那鴻書": "Nahum", "哈巴谷書": "Habakkuk", "西番雅書": "Zephaniah", "哈該書": "Haggai",
    "撒迦利亞書": "Zechariah", "瑪拉基書": "Malachi", "馬太福音": "Matthew", "馬可福音": "Mark",
    "路加福音": "Luke", "約翰福音": "John", "使徒行傳": "Acts", "羅馬書": "Romans", "哥林多前書": "1 Corinthians",
    "哥林多後書": "2 Corinthians", "加拉太書": "Galatians", "以弗所書": "Ephesians", "腓立比書": "Philippians",
    "歌羅西書": "Colossians", "帖撒羅尼迦前書": "1 Thessalonians", "帖撒羅尼迦後書": "2 Thessalonians",
    "提摩太前書": "1 Timothy", "提摩太後書": "2 Timothy", "提多書": "Titus", "腓利門書": "Philemon",
    "希伯來書": "Hebrews", "雅各書": "James", "彼得前書": "1 Peter", "彼得後書": "2 Peter", "約翰一書": "1 John",
    "約翰二書": "2 John", "約翰三書": "3 John", "猶大書": "Jude", "啟示錄": "Revelation"
}

def update_plan():
    print(f"Reading {PLAN_FILE}...")
    with open(PLAN_FILE, 'r', encoding='utf-8') as f:
        plan = json.load(f)

    print(f"Processing {len(plan)} entries...")
    
    for entry in plan:
        zh_book = entry.get('book')
        chapters = entry.get('chapters', [])
        
        # Determine English Book
        en_book = BOOK_MAP.get(zh_book, zh_book) # Fallback to original if not found
        
        # Generate English Description
        if chapters:
            if len(chapters) == 1:
                desc_en = f"{en_book} Chapter {chapters[0]}"
            else:
                # Assuming contiguous chapters mostly, but simplifying for display
                # "Genesis Chapters 1-3"
                # Check for contiguity could be nice but simplified "X-Y" matches user request
                start = chapters[0]
                end = chapters[-1]
                desc_en = f"{en_book} Chapters {start}-{end}"
        else:
            desc_en = f"{en_book} (No chapters specified)"

        # Update entry
        entry['book_en'] = en_book
        entry['description_en'] = desc_en

    print(f"Writing updates back to {PLAN_FILE}...")
    with open(PLAN_FILE, 'w', encoding='utf-8') as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    
    print("Done.")

if __name__ == '__main__':
    update_plan()
