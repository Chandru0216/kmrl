from flask import Flask, request, jsonify, send_from_directory, abort, g
from werkzeug.utils import secure_filename, safe_join
from werkzeug.security import check_password_hash, generate_password_hash
from flask_cors import CORS
import os
import logging
import hmac
import re
import secrets
import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from bson import ObjectId
from datetime import datetime
from pymongo import ASCENDING
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

# AI pipeline (NEW advanced version)
from ai_utils import analyze_document, detect_language, translate_to_english
from source_integration import EmailConnector, INTEGRATION_CONFIG, SourceIntegrationManager
# routing helper (optional AWS publish)
from routing import apply_dual_dispatch

# MongoDB
from db import collection, users_collection

# -------------------------------------------------
# CONFIG
# -------------------------------------------------
logging.basicConfig(level=logging.INFO)

pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_CMD",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe" if os.name == "nt" else "tesseract",
)

# Use explicit path to ensure uploads are in backend folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
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

try:
    collection.create_index("source_id", unique=True, sparse=True, name="source_id_1")
except Exception as e:
    logging.warning("Source deduplication index setup deferred: %s", e)

# -------------------------------------------------
# FLASK INIT
# -------------------------------------------------
app = Flask(__name__)
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
if os.getenv("APP_ENV") == "production" and (not CORS_ORIGINS or "*" in CORS_ORIGINS):
    raise RuntimeError("CORS_ORIGINS must contain the deployed frontend origin in production")
CORS(
    app,
    resources={r"/*": {"origins": CORS_ORIGINS}},
)
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['JSON_SORT_KEYS'] = False

auth_secret = os.getenv("AUTH_SECRET")
if not auth_secret:
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("AUTH_SECRET must be configured in production")
    auth_secret = secrets.token_urlsafe(32)
    logging.warning("Using a temporary development auth secret; sessions expire on restart")
app.secret_key = auth_secret
auth_serializer = URLSafeTimedSerializer(auth_secret, salt="document-routing-auth-v1")
AUTH_TOKEN_MAX_AGE = 8 * 60 * 60
PUBLIC_ENDPOINTS = {"health_check", "register", "login"}

try:
    users_collection.create_index("email", unique=True, name="email_1")
except Exception as error:
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("A unique user email index is required in production") from error
    logging.warning("Could not ensure user email index: %s", error)


@app.before_request
def require_authentication():
    if request.method == "OPTIONS" or request.endpoint in PUBLIC_ENDPOINTS:
        return None

    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return jsonify({"error": "Authentication required"}), 401

    try:
        payload = auth_serializer.loads(
            authorization[7:], max_age=AUTH_TOKEN_MAX_AGE
        )
        user_id = ObjectId(payload["user_id"])
    except (BadSignature, SignatureExpired, KeyError, TypeError, ValueError):
        return jsonify({"error": "Invalid or expired session"}), 401

    user = users_collection.find_one({"_id": user_id})
    if not user:
        return jsonify({"error": "Invalid or expired session"}), 401

    g.current_user = user
    return None


def create_auth_response(user, status=200):
    token = auth_serializer.dumps({"user_id": str(user["_id"])})
    public_user = {
        "email": user["email"],
        "fullname": user["fullname"],
        "department": user["department"],
    }
    return jsonify({"token": token, "user": public_user}), status


@app.route("/auth/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return "", 204

    expected_code = os.getenv("REGISTRATION_CODE")
    if not expected_code:
        return jsonify({"error": "Account registration is not configured"}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid account details"}), 400
    email = payload.get("email", "")
    password = payload.get("password", "")
    fullname = payload.get("fullname", "")
    department = payload.get("department", "")
    registration_code = payload.get("registration_code", "")

    if not all(isinstance(value, str) for value in (email, password, fullname, department)):
        return jsonify({"error": "Invalid account details"}), 400
    email = email.strip().lower()
    fullname = fullname.strip()
    department = department.strip()

    if not hmac.compare_digest(str(registration_code), expected_code):
        return jsonify({"error": "Invalid registration code"}), 403
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        return jsonify({"error": "Enter a valid email address"}), 400
    if not 12 <= len(password) <= 128:
        return jsonify({"error": "Password must be between 12 and 128 characters"}), 400
    if not fullname or len(fullname) > 120 or len(department) > 80:
        return jsonify({"error": "Invalid account details"}), 400
    if users_collection.find_one({"email": email}):
        return jsonify({"error": "An account with that email already exists"}), 409

    user = {
        "email": email,
        "password_hash": generate_password_hash(password, method="scrypt"),
        "fullname": fullname,
        "department": department,
        "created_at": datetime.utcnow(),
    }
    try:
        result = users_collection.insert_one(user)
        user["_id"] = result.inserted_id
    except Exception:
        if users_collection.find_one({"email": email}):
            return jsonify({"error": "An account with that email already exists"}), 409
        logging.exception("Account registration failed")
        return jsonify({"error": "Account registration failed"}), 500

    return create_auth_response(user, 201)


@app.route("/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Email or password is incorrect"}), 401
    email = payload.get("email", "")
    password = payload.get("password", "")
    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email or password is incorrect"}), 401
    user = users_collection.find_one({"email": email.strip().lower()})
    password_hash = user.get("password_hash", "") if user else ""
    if not user or not isinstance(password_hash, str) or not check_password_hash(password_hash, password):
        return jsonify({"error": "Email or password is incorrect"}), 401

    return create_auth_response(user)


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"}), 200

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
                poppler_path = os.getenv("POPPLER_PATH")
                if poppler_path is None and os.name == "nt":
                    poppler_path = r"C:\poppler\bin"
                images = convert_from_path(path, poppler_path=poppler_path, dpi=300)
                for img in images:
                    text += pytesseract.image_to_string(img, lang="eng+mal")
                logging.info(f"OCR extraction from PDF: {len(text)} chars")
            except Exception as e:
                logging.error(f"OCR failed: {e}")
    
    return text


# -------------------------------------------------
# UPLOAD
# -------------------------------------------------
class DocumentIngestionError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def ingest_document(filename, content, source_type="upload", metadata=None, source_id=None):
    filename = secure_filename(filename or "")
    if not filename or not allowed_file(filename):
        raise DocumentIngestionError("Only PDF, TXT, PNG, JPG files are allowed")
    if not isinstance(content, bytes) or not content:
        raise DocumentIngestionError("The attachment is empty or invalid")
    if len(content) > MAX_FILE_SIZE:
        raise DocumentIngestionError("File exceeds 10MB limit", 413)
    if source_id and collection.find_one({"source_id": source_id}):
        raise DocumentIngestionError("This email attachment was already imported", 409)
    if collection.find_one({"filename": filename}):
        raise DocumentIngestionError("File already exists", 409)

    filepath = os.path.abspath(os.path.join(UPLOAD_FOLDER, filename))
    saved = False
    try:
        with open(filepath, "xb") as stored_file:
            stored_file.write(content)
        saved = True

        text = extract_text_from_file(filepath)
        if not text.strip():
            raise DocumentIngestionError("Text extraction failed", 422)

        ai_result = analyze_document(text)
        doc_data = {
            "filename": filename,
            "summary": ai_result["summary"],
            "key_points": ai_result.get("key_points", []),
            "language": ai_result["language"],
            "category": ai_result["category"],
            "department": ai_result.get("department"),
            "deadline": ai_result["deadline"],
            "actions": ai_result["actions"],
            "keywords": ai_result["keywords"],
            "financial_data": ai_result.get("financial_data", {}),
            "decisions_commitments": ai_result.get("decisions_commitments", {}),
            "compliance_flags": ai_result.get("compliance_flags", {}),
            "routing_recipients": ai_result.get("routing_recipients", []),
            "routing_details": ai_result.get("routing_details", []),
            "department_scores": ai_result.get("department_scores", {}),
            "department_priorities": ai_result.get("department_priorities", {}),
            "predictive_alerts": ai_result.get("predictive_alerts", []),
            "status": "Pending",
            "uploaded_at": datetime.utcnow(),
            "path": filepath,
            "source_type": source_type,
        }
        if source_id:
            doc_data["source_id"] = source_id
        if metadata:
            doc_data.update(metadata)

        result = collection.insert_one(doc_data)
        doc_data["_id"] = str(result.inserted_id)
        try:
            apply_dual_dispatch(
                doc_data["_id"], filename, doc_data.get("routing_details", []), collection
            )
        except Exception as error:
            logging.warning("Routing dispatch failed or is not configured: %s", error)
        return doc_data
    except Exception:
        if saved and os.path.exists(filepath):
            os.remove(filepath)
        raise


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

    try:
        doc_data = ingest_document(file.filename, file.read())
        return jsonify(doc_data), 200
    except DocumentIngestionError as error:
        return jsonify({"error": str(error)}), error.status_code
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
email_config = INTEGRATION_CONFIG["email"]
if email_config.get("email") and email_config.get("password"):
    source_manager.register_source("email", EmailConnector(email_config))


def ingest_email_attachments(documents):
    synced = 0
    skipped = 0
    errors = []
    imported = []

    for doc in documents:
        original_filename = doc.get("filename", "")
        try:
            safe_original = secure_filename(original_filename)
            source_id = doc.get("source_id")
            if not safe_original or not source_id:
                raise DocumentIngestionError("Missing attachment identity")
            if collection.find_one({"source_id": source_id}):
                skipped += 1
                continue

            extension = os.path.splitext(safe_original)[1]
            base_name = os.path.splitext(safe_original)[0][:160]
            stored_filename = f"email_{source_id[:12]}_{base_name}{extension}"
            stored_doc = ingest_document(
                stored_filename,
                doc.get("content"),
                source_type="email",
                source_id=source_id,
                metadata={
                    "original_filename": safe_original,
                    "email_sender": str(doc.get("sender", "Unknown"))[:320],
                    "email_subject": str(doc.get("subject", "No Subject"))[:500],
                    "email_message_id": str(doc.get("message_id", ""))[:255],
                },
            )
            imported.append({
                "_id": stored_doc["_id"],
                "filename": stored_doc["filename"],
                "original_filename": safe_original,
            })
            synced += 1
        except Exception as error:
            errors.append({"filename": str(original_filename)[:255], "error": str(error)})
            logging.error("Failed to import email attachment %s: %s", original_filename, error)

    return {
        "synced": synced,
        "skipped": skipped,
        "failed": len(errors),
        "errors": errors[:10],
        "documents": imported,
    }


# -------------------------------------------------
# SOURCE INTEGRATION - SYNC ALL SOURCES
# -------------------------------------------------
@app.route("/sync-sources", methods=["POST", "OPTIONS"])
def sync_all_sources():
    if request.method == "OPTIONS":
        return "", 204
    
    try:
        logging.info("Starting source synchronization...")
        if not source_manager.sources:
            return jsonify({"error": "No document sources are configured"}), 503
        documents = source_manager.sync_all_sources()

        if any(doc.get("source") == "email" for doc in documents):
            result = ingest_email_attachments(documents)
            result["message"] = "Email synchronization complete"
            return jsonify(result), 200
        
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
        if source_name == "email" and source_name not in source_manager.sources:
            return jsonify({
                "error": "Email sync is not configured. Set IMAP_HOST, EMAIL_ADDRESS, and EMAIL_PASSWORD."
            }), 503

        documents = source_manager.sync_source(source_name)
        if source_name == "email":
            result = ingest_email_attachments(documents)
            result["message"] = "Email synchronization complete"
            return jsonify(result), 200

        synced_count = 0
        skipped_count = 0
        failed = []
        imported = []
        
        for doc in documents:
            try:
                if collection.find_one({"filename": doc["filename"]}):
                    logging.warning(f"Document {doc['filename']} already exists")
                    skipped_count += 1
                    continue
                
                doc["status"] = "Pending"
                doc["uploaded_at"] = datetime.utcnow()
                doc["source_type"] = source_name
                
                collection.insert_one(doc)
                synced_count += 1
            
            except Exception as e:
                failed.append({"filename": doc.get("filename", "unknown"), "error": str(e)})
                logging.error(f"Failed to sync {doc.get('filename')}: {e}")
        
        return jsonify({
            "message": f"Synced from {source_name}",
            "synced": synced_count,
            "skipped": skipped_count,
            "failed": len(failed),
            "errors": failed[:10],
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
