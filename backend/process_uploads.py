#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, '.')
from datetime import datetime
from db import collection
# Use the unified analysis path to get new routing fields
from ai_utils import analyze_document
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
        if not text or not text.strip():
            print(f"  -> No text extracted from {fname}. Skipping.")
            continue

        ai_result = analyze_document(text)

        doc_data = {
            'filename': fname,
            'language': ai_result.get('language'),
            'summary': ai_result.get('summary'),
            'keywords': ai_result.get('keywords', []),
            'category': ai_result.get('category'),
            'department': ai_result.get('department'),
            'deadline': ai_result.get('deadline'),
            'actions': ai_result.get('actions', []),
            'status': 'Pending',
            'uploaded_at': datetime.utcnow(),
            'path': path,
            # New routing fields
            'routing_recipients': ai_result.get('routing_recipients', []),
            'routing_details': ai_result.get('routing_details', []),
            'department_scores': ai_result.get('department_scores', {}),
            'department_priorities': ai_result.get('department_priorities', {}),
        }

        res = collection.insert_one(doc_data)
        print(f"  -> Inserted with _id: {res.inserted_id}")
    except Exception as e:
        print(f"  -> Error processing {fname}: {e}")

print('\n=== DONE ===\n')
