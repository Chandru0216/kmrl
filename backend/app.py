from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename, safe_join
from flask_cors import CORS
import os
import logging
import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from bson import ObjectId
from datetime import datetime
from pymongo import ASCENDING

# AI pipeline (NEW advanced version)
from ai_utils import analyze_document, detect_language, translate_to_english
from source_integration import SourceIntegrationManager

# MongoDB
from db import collection

# -------------------------------------------------
# CONFIG
# -------------------------------------------------
logging.basicConfig(level=logging.INFO)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Use explicit path to ensure uploads are in backend folder
UPLOAD_FOLDER = r"C:\Users\chand\Desktop\kmrl\backend\uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "txt", "png", "jpg", "jpeg"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Ensure unique filename index (prevents duplicates properly)
try:
    # Get existing indexes
    indexes = collection.index_information()

    # Check if filename_1 already exists
    if "filename_1" in indexes:
        if not indexes["filename_1"].get("unique", False):
            print("Dropping old non-unique index...")
            collection.drop_index("filename_1")

    # Create unique index safely
    collection.create_index(
        [("filename", ASCENDING)],
        unique=True,
        name="filename_1"
    )

    print("Unique index ensured for filename")
except Exception as e:
    print(f"⚠ Index setup deferred: {str(e)[:100]}...")

# -------------------------------------------------
# FLASK INIT
# -------------------------------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['JSON_SORT_KEYS'] = False

# -------------------------------------------------
# HELPERS
# -------------------------------------------------
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text_from_file(path):
    """Extract text from PDF, TXT, PNG, JPG files"""
    text = ""
    file_ext = path.rsplit(".", 1)[1].lower()
    
    # Handle text files
    if file_ext == "txt":
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            logging.info(f"Text extracted from TXT file: {len(text)} chars")
            return text
        except Exception as e:
            logging.error(f"TXT extraction failed: {e}")
            return ""
    
    # Handle images (PNG, JPG)
    if file_ext in ["png", "jpg", "jpeg"]:
        try:
            from PIL import Image
            img = Image.open(path)
            text = pytesseract.image_to_string(img, lang="eng+mal")
            logging.info(f"Text extracted from image: {len(text)} chars")
            return text
        except Exception as e:
            logging.error(f"Image extraction failed: {e}")
            return ""
    
    # Handle PDFs
    if file_ext == "pdf":
        try:
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() or ""
            logging.info(f"Text extracted from PDF: {len(text)} chars")
        except Exception as e:
            logging.warning(f"pdfplumber failed: {e}")
        
        # OCR fallback for PDFs
        if not text.strip():
            try:
                images = convert_from_path(path, poppler_path=r"C:\poppler\bin", dpi=300)
                for img in images:
                    text += pytesseract.image_to_string(img, lang="eng+mal")
                logging.info(f"OCR extraction from PDF: {len(text)} chars")
            except Exception as e:
                logging.error(f"OCR failed: {e}")
    
    return text


# -------------------------------------------------
# UPLOAD
# -------------------------------------------------
@app.route("/upload", methods=["POST", "OPTIONS"])
def upload_file():
    if request.method == "OPTIONS":
        return "", 204

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF, TXT, PNG, JPG files allowed"}), 400

    filename = secure_filename(file.filename)

    # File size check
    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)

    if file_length > MAX_FILE_SIZE:
        return jsonify({"error": "File exceeds 10MB limit"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, filename)

    # Duplicate prevention via DB unique index
    if collection.find_one({"filename": filename}):
        return jsonify({"error": "File already exists"}), 400

    file.save(filepath)
    filepath = os.path.abspath(filepath)  # Ensure absolute path
    logging.info(f"File saved: {filepath}")

    try:
        text = extract_text_from_file(filepath)

        if not text.strip():
            return jsonify({"error": "Text extraction failed"}), 400

        logging.info(f"Text extracted, running AI analysis...")
        ai_result = analyze_document(text)
        logging.info(f"AI analysis complete")

        doc_data = {
            "filename": filename,
            "summary": ai_result["summary"],
            "key_points": ai_result.get("key_points", []),
            "language": ai_result["language"],
            "category": ai_result["category"],
            "department": ai_result["department"],
            "deadline": ai_result["deadline"],
            "actions": ai_result["actions"],
            "keywords": ai_result["keywords"],
            "financial_data": ai_result.get("financial_data", {}),
            "decisions_commitments": ai_result.get("decisions_commitments", {}),
            "compliance_flags": ai_result.get("compliance_flags", {}),
            "routing_recipients": ai_result.get("routing_recipients", []),
            "predictive_alerts": ai_result.get("predictive_alerts", []),
            "status": "Pending",
            "uploaded_at": datetime.utcnow(),
            "path": filepath
        }

        result = collection.insert_one(doc_data)
        doc_data["_id"] = str(result.inserted_id)
        logging.info(f"Document inserted with ID: {doc_data['_id']}")

        return jsonify(doc_data), 200

    except Exception as e:
        logging.error(f"Upload failed: {e}", exc_info=True)
        return jsonify({"error": "Processing failed", "details": str(e)}), 500


# -------------------------------------------------
# GET DOCUMENTS
# -------------------------------------------------
@app.route("/documents", methods=["GET", "OPTIONS"])
def get_documents():
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logging.info("Fetching documents from database")
        docs = list(collection.find().sort("uploaded_at", -1))
        logging.info(f"Found {len(docs)} documents")
        
        for doc in docs:
            doc["_id"] = str(doc["_id"])
        
        return jsonify(docs), 200
    except Exception as e:
        logging.error(f"Error fetching documents: {e}", exc_info=True)
        return jsonify({"error": "Fetch failed", "details": str(e)}), 500


# -------------------------------------------------
# SEARCH
# -------------------------------------------------
@app.route("/search", methods=["GET"])
def search_docs():
    query = request.args.get("q", "")

    try:
        results = list(collection.find({
            "$or": [
                {"filename": {"$regex": query, "$options": "i"}},
                {"category": {"$regex": query, "$options": "i"}},
                {"department": {"$regex": query, "$options": "i"}},
                {"summary": {"$regex": query, "$options": "i"}}
            ]
        }))

        for doc in results:
            doc["_id"] = str(doc["_id"])

        return jsonify(results), 200

    except:
        return jsonify([]), 200


# -------------------------------------------------
# UPDATE STATUS
# -------------------------------------------------
@app.route("/update-status/<doc_id>", methods=["PUT", "OPTIONS"])
def update_status(doc_id):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logging.info(f"Updating status for doc: {doc_id}")
        
        from bson import ObjectId
        doc_oid = ObjectId(doc_id)
        
        result = collection.update_one(
            {"_id": doc_oid},
            {"$set": {"status": "Completed"}}
        )
        
        logging.info(f"Update result: {result}")
        return jsonify({"message": "Updated", "doc_id": doc_id}), 200
    except Exception as e:
        logging.error(f"Update failed: {e}", exc_info=True)
        return jsonify({"error": "Update failed", "details": str(e)}), 500


# -------------------------------------------------
# DELETE DOCUMENT (FIXED PROPERLY)
# -------------------------------------------------
@app.route("/delete/<doc_id>", methods=["DELETE", "OPTIONS"])
def delete_document(doc_id):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logging.info(f"Deleting document: {doc_id}")
        doc = collection.find_one({"_id": ObjectId(doc_id)})

        if not doc:
            return jsonify({"error": "Document not found"}), 404

        # Remove file from disk (if it exists)
        file_path = doc.get("path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logging.info(f"File removed from disk: {file_path}")
            except Exception as e:
                logging.warning(f"Could not remove file from disk: {e}")

        collection.delete_one({"_id": ObjectId(doc_id)})
        logging.info(f"Document deleted from database: {doc_id}")

        return jsonify({"message": "Deleted successfully"}), 200

    except Exception as e:
        logging.error(f"Delete failed: {e}", exc_info=True)
        return jsonify({"error": "Delete failed", "details": str(e)}), 500


# -------------------------------------------------
# FIXED STATS (NO DUPLICATE ISSUE)
# -------------------------------------------------
@app.route("/stats", methods=["GET", "OPTIONS"])
def stats():
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logging.info("Calculating stats")
        total = collection.count_documents({})
        pending = collection.count_documents({"status": "Pending"})
        completed = collection.count_documents({"status": "Completed"})
        safety = collection.count_documents({"category": "Safety Circular"})

        result = {
            "total_docs": total,
            "pending": pending,
            "completed": completed,
            "safety_alerts": safety
        }
        
        logging.info(f"Stats calculated: {result}")
        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error calculating stats: {e}", exc_info=True)
        return jsonify({"error": "Stats failed", "details": str(e)}), 500


# -------------------------------------------------
# TRANSLATE
# -------------------------------------------------
@app.route("/translate", methods=["POST", "OPTIONS"])
def translate():
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        data = request.get_json()
        text = data.get("text", "")
        source_language = data.get("source_language", "auto")
        target_language = data.get("target_language", "en")
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Detect language if auto
        if source_language == "auto":
            source_language = detect_language(text)
            logging.info(f"Auto-detected language: {source_language}")
        
        # Translate
        translated_text = translate_to_english(text, source_language)
        
        return jsonify({
            "translated_text": translated_text,
            "source_language": source_language,
            "target_language": target_language
        }), 200
    
    except Exception as e:
        logging.error(f"Translation failed: {e}", exc_info=True)
        return jsonify({"error": "Translation failed", "details": str(e)}), 500


# -------------------------------------------------
# DOWNLOAD
# -------------------------------------------------
@app.route("/download/<path:filename>")
def download_file(filename):
    safe_path = safe_join(os.path.abspath(UPLOAD_FOLDER), filename)

    if not safe_path or not os.path.exists(safe_path):
        abort(404)

    return send_from_directory(
        os.path.abspath(UPLOAD_FOLDER),
        filename,
        as_attachment=True
    )


# -------------------------------------------------
# VIEW PDF (Inline - for PDFViewer)
# -------------------------------------------------
@app.route("/uploads/<path:filename>", methods=["GET", "OPTIONS"])
def view_file(filename):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        safe_path = safe_join(os.path.abspath(UPLOAD_FOLDER), filename)
        
        if not safe_path or not os.path.exists(safe_path):
            logging.error(f"File not found: {filename}")
            abort(404)
        
        # Determine MIME type based on file extension
        file_ext = filename.rsplit(".", 1)[1].lower() if "." in filename else ""
        mime_types = {
            "pdf": "application/pdf",
            "txt": "text/plain",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg"
        }
        mimetype = mime_types.get(file_ext, "application/octet-stream")
        
        return send_from_directory(
            os.path.abspath(UPLOAD_FOLDER),
            filename,
            as_attachment=False,
            mimetype=mimetype
        )
    except Exception as e:
        logging.error(f"Error serving file {filename}: {e}")
        abort(404)


# -------------------------------------------------
# EXECUTIVE SUMMARY
# -------------------------------------------------
@app.route("/summarize/<doc_id>", methods=["GET", "OPTIONS"])
def get_summary(doc_id):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        from ai_utils import generate_executive_summary
        doc = collection.find_one({"_id": ObjectId(doc_id)})
        
        if not doc:
            return jsonify({"error": "Document not found"}), 404
        
        text = extract_text_from_file(doc["path"])
        summary_data = generate_executive_summary(text)
        
        return jsonify(summary_data), 200
    
    except Exception as e:
        logging.error(f"Summary generation failed: {e}", exc_info=True)
        return jsonify({"error": "Summary failed", "details": str(e)}), 500


# -------------------------------------------------
# CONTENT INTELLIGENCE
# -------------------------------------------------
@app.route("/extract-intelligence/<doc_id>", methods=["GET", "OPTIONS"])
def extract_intelligence(doc_id):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        from ai_utils import (extract_financial_data, extract_decisions_commitments,
                             extract_action_items, extract_keywords)
        
        doc = collection.find_one({"_id": ObjectId(doc_id)})
        
        if not doc:
            return jsonify({"error": "Document not found"}), 404
        
        text = extract_text_from_file(doc["path"])
        
        intelligence = {
            "financial_data": extract_financial_data(text),
            "decisions_commitments": extract_decisions_commitments(text),
            "action_items": extract_action_items(text),
            "keywords": extract_keywords(text)
        }
        
        return jsonify(intelligence), 200
    
    except Exception as e:
        logging.error(f"Intelligence extraction failed: {e}", exc_info=True)
        return jsonify({"error": "Extraction failed", "details": str(e)}), 500


# -------------------------------------------------
# COMPLIANCE CHECK
# -------------------------------------------------
@app.route("/compliance-check/<doc_id>", methods=["GET", "OPTIONS"])
def check_compliance(doc_id):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        from ai_utils import check_compliance_flags, generate_predictive_alerts
        
        doc = collection.find_one({"_id": ObjectId(doc_id)})
        
        if not doc:
            return jsonify({"error": "Document not found"}), 404
        
        text = extract_text_from_file(doc["path"])
        compliance_flags = check_compliance_flags(text)
        alerts = generate_predictive_alerts(text, doc.get("category", ""), compliance_flags)
        
        return jsonify({
            "compliance_flags": compliance_flags,
            "predictive_alerts": alerts
        }), 200
    
    except Exception as e:
        logging.error(f"Compliance check failed: {e}", exc_info=True)
        return jsonify({"error": "Compliance check failed", "details": str(e)}), 500


# -------------------------------------------------
# SMART ROUTING
# -------------------------------------------------
@app.route("/route-document/<doc_id>", methods=["GET", "OPTIONS"])
def route_document(doc_id):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        from ai_utils import determine_recipients, check_compliance_flags
        
        doc = collection.find_one({"_id": ObjectId(doc_id)})
        
        if not doc:
            return jsonify({"error": "Document not found"}), 404
        
        text = extract_text_from_file(doc["path"])
        compliance_flags = check_compliance_flags(text)
        recipients = determine_recipients(doc.get("category", ""), doc.get("department", ""), compliance_flags)
        
        return jsonify({
            "recipients": recipients,
            "routing_reason": "Smart routing based on category, department, and compliance flags"
        }), 200
    
    except Exception as e:
        logging.error(f"Routing failed: {e}", exc_info=True)
        return jsonify({"error": "Routing failed", "details": str(e)}), 500


# -------------------------------------------------
# PREDICTIVE ALERTS
# -------------------------------------------------
@app.route("/predictive-alerts/<doc_id>", methods=["GET", "OPTIONS"])
def get_predictive_alerts(doc_id):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        from ai_utils import generate_predictive_alerts, check_compliance_flags
        
        doc = collection.find_one({"_id": ObjectId(doc_id)})
        
        if not doc:
            return jsonify({"error": "Document not found"}), 404
        
        text = extract_text_from_file(doc["path"])
        compliance_flags = check_compliance_flags(text)
        alerts = generate_predictive_alerts(text, doc.get("category", ""), compliance_flags)
        
        return jsonify({"alerts": alerts}), 200
    
    except Exception as e:
        logging.error(f"Predictive alerts failed: {e}", exc_info=True)
        return jsonify({"error": "Alerts failed", "details": str(e)}), 500


# -------------------------------------------------
# COMPLIANCE DASHBOARD
# -------------------------------------------------
@app.route("/compliance-dashboard", methods=["GET", "OPTIONS"])
def compliance_dashboard():
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        from ai_utils import check_compliance_flags
        
        all_docs = list(collection.find())
        
        compliance_metrics = {
            "total_with_compliance_terms": 0,
            "total_with_regulatory_keywords": 0,
            "critical_urgency": 0,
            "high_urgency": 0,
            "departments_at_risk": {},
            "compliance_tracker": []
        }
        
        dept_risk = {}
        
        for doc in all_docs:
            try:
                text = extract_text_from_file(doc["path"])
                flags = check_compliance_flags(text)
                
                if flags.get("has_compliance_terms"):
                    compliance_metrics["total_with_compliance_terms"] += 1
                
                if flags.get("has_regulatory_keywords"):
                    compliance_metrics["total_with_regulatory_keywords"] += 1
                
                urgency = flags.get("urgency_level", "Normal")
                if urgency == "Critical":
                    compliance_metrics["critical_urgency"] += 1
                elif urgency == "High":
                    compliance_metrics["high_urgency"] += 1
                
                for dept in flags.get("departments_affected", []):
                    if dept not in dept_risk:
                        dept_risk[dept] = 0
                    dept_risk[dept] += 1
                
                if flags.get("has_regulatory_keywords") or flags.get("urgency_level") in ["Critical", "High"]:
                    compliance_metrics["compliance_tracker"].append({
                        "_id": str(doc.get("_id", "")),
                        "filename": doc.get("filename", ""),
                        "category": doc.get("category", ""),
                        "urgency": urgency,
                        "regulatory": flags.get("has_regulatory_keywords"),
                        "departments": flags.get("departments_affected", [])
                    })
            
            except Exception as e:
                logging.warning(f"Could not check compliance for {doc.get('filename')}: {e}")
                continue
        
        compliance_metrics["departments_at_risk"] = dept_risk
        
        return jsonify(compliance_metrics), 200
    
    except Exception as e:
        logging.error(f"Compliance dashboard failed: {e}", exc_info=True)
        return jsonify({"error": "Dashboard failed", "details": str(e)}), 500


# -------------------------------------------------
# ALERT CENTER (all alerts across system)
# -------------------------------------------------
@app.route("/alert-center", methods=["GET", "OPTIONS"])
def alert_center():
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        from ai_utils import generate_predictive_alerts, check_compliance_flags
        from datetime import datetime, timedelta
        
        all_docs = list(collection.find())
        all_alerts = []
        
        for doc in all_docs:
            try:
                text = extract_text_from_file(doc["path"])
                compliance_flags = check_compliance_flags(text)
                alerts = generate_predictive_alerts(text, doc.get("category", ""), compliance_flags)
                
                for alert in alerts:
                    all_alerts.append({
                        "_id": str(doc["_id"]),
                        "doc_id": str(doc["_id"]),
                        "doc_filename": doc.get("filename", ""),
                        "alert_type": alert.get("type", ""),
                        "priority": alert.get("priority", "Normal"),
                        "message": alert.get("message", ""),
                        "timestamp": doc.get("uploaded_at", datetime.utcnow())
                    })
            
            except Exception as e:
                logging.warning(f"Could not generate alerts for {doc.get('filename')}: {e}")
                continue
        
        # Sort by priority and timestamp
        priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Normal": 3}
        all_alerts.sort(key=lambda x: (priority_order.get(x.get("priority"), 4), 
                                       x.get("timestamp", datetime.utcnow())), reverse=True)
        
        return jsonify({
            "total_alerts": len(all_alerts),
            "alerts": all_alerts[:20]  # Return top 20 alerts
        }), 200
    
    except Exception as e:
        logging.error(f"Alert center failed: {e}", exc_info=True)
        return jsonify({"error": "Alert center failed", "details": str(e)}), 500


# Initialize source integration manager
source_manager = SourceIntegrationManager()


# -------------------------------------------------
# SOURCE INTEGRATION - SYNC ALL SOURCES
# -------------------------------------------------
@app.route("/sync-sources", methods=["POST", "OPTIONS"])
def sync_all_sources():
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logging.info("Starting source synchronization...")
        documents = source_manager.sync_all_sources()
        
        synced_count = 0
        failed_count = 0
        
        for doc in documents:
            try:
                # Check if document already exists
                if collection.find_one({"filename": doc["filename"]}):
                    logging.warning(f"Document {doc['filename']} already exists")
                    continue
                
                # Save document to database
                doc["status"] = "Pending"
                doc["uploaded_at"] = datetime.utcnow()
                doc["source_type"] = doc.get("source", "Unknown")
                
                result = collection.insert_one(doc)
                synced_count += 1
                logging.info(f"Synced: {doc['filename']}")
            
            except Exception as e:
                failed_count += 1
                logging.error(f"Failed to sync {doc.get('filename')}: {e}")
        
        return jsonify({
            "message": "Source synchronization complete",
            "synced": synced_count,
            "failed": failed_count,
            "documents": documents[:10]  # Return first 10 for preview
        }), 200
    
    except Exception as e:
        logging.error(f"Source sync failed: {e}", exc_info=True)
        return jsonify({"error": "Sync failed", "details": str(e)}), 500


# -------------------------------------------------
# SOURCE INTEGRATION - SYNC SPECIFIC SOURCE
# -------------------------------------------------
@app.route("/sync-source/<source_name>", methods=["POST", "OPTIONS"])
def sync_specific_source(source_name):
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logging.info(f"Syncing source: {source_name}")
        documents = source_manager.sync_source(source_name)
        
        synced_count = 0
        
        for doc in documents:
            try:
                if collection.find_one({"filename": doc["filename"]}):
                    logging.warning(f"Document {doc['filename']} already exists")
                    continue
                
                doc["status"] = "Pending"
                doc["uploaded_at"] = datetime.utcnow()
                doc["source_type"] = source_name
                
                collection.insert_one(doc)
                synced_count += 1
            
            except Exception as e:
                logging.error(f"Failed to sync {doc.get('filename')}: {e}")
        
        return jsonify({
            "message": f"Synced from {source_name}",
            "synced": synced_count,
            "documents": documents[:5]
        }), 200
    
    except Exception as e:
        logging.error(f"Source sync failed: {e}", exc_info=True)
        return jsonify({"error": "Sync failed", "details": str(e)}), 500


# -------------------------------------------------
# RUN
# -------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True)
