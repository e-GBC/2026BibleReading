import pandas as pd
import json
import os
import sys

def parse_bible_plan(excel_path, output_path):
    """
    Parses the Bible reading plan from Excel and saves it as JSON.
    
    Expected Excel columns (inferred):
    - Date information (Month, Day)
    - Reading passages (e.g., "Gen 1-3", "Ps 1")
    """
    print(f"Reading from: {excel_path}")
    
    try:
        # Load the Excel file. 
        # Note: We need to inspect the file content first to know the exact layout.
        # But based on the user prompt "讀經進度.xlsx", we'll attempt a standard read.
        # If the structure is complex (headers on row 2, etc.), we might need adjustment.
        df = pd.read_excel(excel_path)
        
        # For now, let's just dump the raw data structure so we can clearly see what it looks like
        # before we write specific logic to renaming columns.
        # This first run is primarily to explore the data structure.
        
        print("Columns found:", df.columns.tolist())
        print("First few rows:")
        print(df.head())
        
        # Filter out rows where '日期' is not a datetime (e.g., month headers)
        # We check if it can be coerced to datetime, else drop.
        df['日期'] = pd.to_datetime(df['日期'], errors='coerce')
        df = df.dropna(subset=['日期'])

        # Convert date to string format YYYY-MM-DD
        df['日期'] = df['日期'].dt.strftime('%Y-%m-%d')
        
        # Process chapters columns (1-8)
        # We'll create a new list of dictionaries cleaner than the raw dump
        clean_records = []
        
        chapter_cols = [c for c in df.columns if isinstance(c, int)]
        
        for _, row in df.iterrows():
            # Collect chapters, ignoring NaNs
            chapters = []
            for col in chapter_cols:
                val = row[col]
                if pd.notnull(val):
                    try:
                        chapters.append(int(val))
                    except:
                        chapters.append(val) # Keep as is if not int (though likely int)
            
            record = {
                "date": row['日期'],
                "description": row['歷史進度敘述'],
                "book": row['經文範圍'],
                "chapters": chapters
            }
            clean_records.append(record)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(clean_records, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully wrote {len(clean_records)} records to {output_path}")

    except Exception as e:
        print(f"Error processing file: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_file = os.path.join(base_dir, 'data', '讀經進度.xlsx')
    output_file = os.path.join(base_dir, 'data', 'reading_plan.json')
    
    if not os.path.exists(input_file):
        print(f"Error: Input file not found at {input_file}")
        sys.exit(1)
        
    parse_bible_plan(input_file, output_file)
