import pdfplumber
import json
import os
import re
import sys

def parse_bible_pdf(pdf_path, output_path):
    print(f"Parsing PDF: {pdf_path}")
    
    # Full list of Chinese Bible Books
    bible_books = [
        "創世記", "出埃及記", "利未記", "民數記", "申命記", "約書亞記", "士師記", "路得記",
        "撒母耳記上", "撒母耳記下", "列王紀上", "列王紀下", "歷代志上", "歷代志下",
        "以斯拉記", "尼希米記", "以斯帖記", "約伯記", "詩篇", "箴言", "傳道書", "雅歌",
        "以賽亞書", "耶利米書", "耶利米哀歌", "以西結書", "但以理書", "何西阿書", "約珥書",
        "阿摩司書", "俄巴底亞書", "約拿書", "彌迦書", "那鴻書", "哈巴谷書", "西番雅書",
        "哈該書", "撒迦利亞書", "瑪拉基書",
        "馬太福音", "馬可福音", "路加福音", "約翰福音", "使徒行傳", "羅馬書", "哥林多前書",
        "哥林多後書", "加拉太書", "以弗所書", "腓立比書", "歌羅西書", "帖撒羅尼迦前書",
        "帖撒羅尼迦後書", "提摩太前書", "提摩太後書", "提多書", "腓利門書", "希伯來書",
        "雅各書", "彼得前書", "彼得後書", "約翰一書", "約翰二書", "約翰三書", "猶大書",
        "啟示錄"
    ]
    
    current_book_name = ""
    current_chapter = 0
    current_verse = 0
    
    # Structure: { "BookName": { "1": { "1": "Text..." } } }
    bible_json = {}

    try:
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"Total pages: {total_pages}")
            
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if not text:
                    continue
                    
                lines = text.split('\n')
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                        
                    # 1. Check for Book Name (Exact match usually, or assume checking against list)
                    # Note: Sometimes headers are "創世記 Genesis", we check if the line STARTS with a book name
                    # AND is short enough to be a title.
                    is_book_title = False
                    for bk in bible_books:
                        if line == bk or (line.startswith(bk) and len(line) < len(bk) + 5):
                            # Ensure it's not a false positive inside text?
                            # Usually titles are on their own line.
                            # Also check we aren't already in this book (headers repeat?)
                            if current_book_name != bk:
                                print(f"Found Book: {bk}")
                                # Save progress from previous book before switching
                                if current_book_name:
                                    print(f"  Saving {current_book_name}...")
                                    with open(output_path, 'w', encoding='utf-8') as f:
                                        json.dump(bible_json, f, ensure_ascii=False, indent=2)
                                
                                current_book_name = bk
                                bible_json[current_book_name] = {}
                                current_chapter = 1
                                current_verse = 0 
                                # Reset for new book. 
                                # NOTE: Chapter 1 is implied at start of book usually
                                bible_json[current_book_name][str(current_chapter)] = {}
                            is_book_title = True
                            break
                    
                    if is_book_title:
                        continue

                    if not current_book_name:
                        continue # Skip TOC or preamble

                    # 2. Check for Verse Number
                    # Regex: Start with number, then text.
                    # Caution: "123" page number. "Chapter 2"
                    
                    # Heuristic: If we see "1" and we already have verses > 1 in current chapter,
                    # it indicates NEW CHAPTER.
                    
                    match = re.match(r'^(\d+)\s*(.*)', line)
                    if match:
                        num = int(match.group(1))
                        content = match.group(2).strip()
                        
                        # Is this a page number? (If line is ONLY a number, or very short)
                        # We ignore lines that are just numbers (could be page numbers)
                        if not content and len(line) < 5:
                             continue

                        # Is it a new chapter?
                        # If num == 1 and we already have verses in current_chapter, it's likely a new chapter.
                        if num == 1 and str(current_chapter) in bible_json[current_book_name] and len(bible_json[current_book_name][str(current_chapter)]) > 0:
                            current_chapter += 1
                            bible_json[current_book_name][str(current_chapter)] = {}
                            # print(f"  -> New Chapter {current_chapter} detected in {current_book_name}")
                        
                        # It is a verse
                        current_verse = num
                        if str(current_chapter) not in bible_json[current_book_name]:
                             bible_json[current_book_name][str(current_chapter)] = {}
                             
                        bible_json[current_book_name][str(current_chapter)][str(current_verse)] = content
                        
                    else:
                        # Continuation of previous verse
                        if current_verse > 0:
                            # Verify checking integrity?
                            bible_json[current_book_name][str(current_chapter)][str(current_verse)] += content
                        else:
                            pass # Skip preamble text before verse 1

        # Post-processing / Saving
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(bible_json, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully processed Bible text to {output_path}")

    except Exception as e:
        print(f"Error reading PDF: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_file = os.path.join(base_dir, 'data', 'cmn-cu89t_all.pdf')
    output_file = os.path.join(base_dir, 'data', 'bible_text.json')
    
    if not os.path.exists(input_file):
        print(f"Error: PDF file not found at {input_file}")
        sys.exit(1)
        
    parse_bible_pdf(input_file, output_file)
