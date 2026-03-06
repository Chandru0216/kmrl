#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, '.')
from datetime import datetime
from db import collection
from ai_utils import (
    detect_language,
    translate_to_english,
    summarize_text,
    extract_keywords,
    classify_category,
    map_department,
    extract_deadline,
    extract_action_items,
)
# import helper functions from app without starting Flask server
from app import extract_text_from_file

UPLOADS = 'uploads'

print('\n=== PROCESS UPLOADS ===\n')
files = [f for f in os.listdir(UPLOADS) if f.lower().endswith('.pdf')]
if not files:
    print('No PDF files found in uploads')
    sys.exit(0)

for fname in files:
    print(f"Checking: {fname}")
    if collection.find_one({'filename': fname}):
        print('  -> Already processed (in DB). Skipping.')
        continue
    path = os.path.join(UPLOADS, fname)
    print('  -> Processing file...')
    try:
        text = extract_text_from_file(path)
        language = detect_language(text)
        english_text = translate_to_english(text, language)
        summary = summarize_text(english_text)
        keywords = extract_keywords(english_text)
        category = classify_category(english_text)
        department = map_department(category)
        deadline = extract_deadline(english_text)
        action = extract_action_items(english_text)

        doc_data = {
            'filename': fname,
            'language': language,
            'summary': summary,
            'keywords': keywords,
            'category': category,
            'department': department,
            'deadline': deadline,
            'actions': action,
            'status': 'Pending',
            'uploaded_at': datetime.utcnow(),
            'path': path,
        }
        res = collection.insert_one(doc_data)
        print(f"  -> Inserted with _id: {res.inserted_id}")
    except Exception as e:
        print(f"  -> Error processing {fname}: {e}")

print('\n=== DONE ===\n')
