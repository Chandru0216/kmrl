import re
import logging
from datetime import datetime, timedelta
from collections import Counter

logging.basicConfig(level=logging.INFO)

# Try to import AI libraries, but have fallbacks ready
try:
    import torch
    from transformers import AutoModel, AutoTokenizer, pipeline
    HAS_TRANSFORMERS = True
except:
    HAS_TRANSFORMERS = False
    logging.warning("Transformers not available - using regex fallback")

try:
    from langdetect import detect, LangDetectException
    HAS_LANGDETECT = True
except:
    HAS_LANGDETECT = False
    logging.warning("Langdetect not available - using regex fallback")

try:
    from deep_translator import GoogleTranslator
    HAS_TRANSLATOR = True
except:
    HAS_TRANSLATOR = False
    logging.warning("Deep translator not available - using no translation")


# -------------------------------------------------
# LANGUAGE DETECTION
# -------------------------------------------------
def detect_language(text):
    """Detect language of text"""
    if not text or len(text) < 10:
        return "en"
    
    if HAS_LANGDETECT:
        try:
            lang = detect(text)
            logging.info(f"Detected language: {lang}")
            return lang
        except:
            pass
    
    # Fallback: Simple ML language detection based on common words
    malayalam_words = {'ഉണ്ടായ', 'ഉണ്ടാകും', 'ഇതിന്', 'എന്ന', 'കുറിച്ച്', 'അത്', 'തന്റെ', 'വേണ്ടി', 'തന്നെ', 'നിന്ന്'}
    hindi_words = {'जब', 'जो', 'यह', 'वह', 'करना', 'हैं', 'है', 'के', 'का', 'की'}
    
    text_lower = text.lower()
    
    malayalam_count = sum(1 for word in malayalam_words if word in text_lower)
    hindi_count = sum(1 for word in hindi_words if word in text_lower)
    
    if malayalam_count > 5:
        return "ml"
    elif hindi_count > 5:
        return "hi"
    
    return "en"


# -------------------------------------------------
# TRANSLATION
# -------------------------------------------------
def translate_to_english(text, language):
    """Translate text to English if needed"""
    if language == "en":
        return text
    
    if not HAS_TRANSLATOR:
        logging.warning(f"No translator for {language}, returning original text")
        return text
    
    try:
        translator = GoogleTranslator(source_language=language, target_language='en')
        translated = translator.translate(text)
        logging.info(f"Translated from {language} to en")
        return translated
    except Exception as e:
        logging.error(f"Translation failed: {e}")
        return text


# -------------------------------------------------
# SUMMARIZATION (Fallback)
# -------------------------------------------------
def summarize_text(text):
    """Create a summary using simple extraction"""
    if not text or len(text.strip()) < 50:
        return text or "No content available"
    
    # Simple extractive summarization
    sentences = [s.strip() for s in re.split(r'[.!?]\s+', text) if s.strip()]
    
    if len(sentences) <= 3:
        return '. '.join(sentences) + '.'
    
    # Take first and last sentences, plus longest one
    summaries = [sentences[0]]
    if len(sentences) > 1:
        summaries.append(max(sentences[1:-1], key=len, default=''))
    if len(sentences) > 2:
        summaries.append(sentences[-1])
    
    summary = '. '.join([s for s in summaries if s])
    if not summary.endswith('.'):
        summary += '.'
    
    return summary[:500]


# -------------------------------------------------
# CATEGORY CLASSIFICATION
# -------------------------------------------------
_CATEGORY_DESCRIPTIONS = {
    "Safety Circular": "A safety policy, safety circular, hazard warning, accident prevention instruction, or workplace precaution notice.",
    "Invoice": "A vendor bill or invoice requesting payment for goods or services, including prices, taxes, totals, and payment terms.",
    "Legal Notice": "A formal legal communication about laws, claims, litigation, court proceedings, liability, or regulatory obligations.",
    "Technical Report": "A technical analysis of software, hardware, engineering systems, IT infrastructure, faults, or technical support.",
    "Employee Info": "An employee or human resources record about staff, personnel, attendance, benefits, recruitment, or workplace policy.",
    "Report": "An organizational report presenting operational results, financial analysis, findings, conclusions, or project progress.",
    "Schedule": "A timetable or plan for maintenance, operations, appointments, shifts, events, or work dates.",
    "General Document": "General correspondence or a document that does not primarily concern safety, finance, law, technology, human resources, reporting, or scheduling."
}
_CATEGORY_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_semantic_tokenizer = None
_semantic_model = None
_category_embeddings = None


def _encode_semantic_texts(texts):
    tokens = _semantic_tokenizer(
        texts,
        padding=True,
        truncation=True,
        max_length=256,
        return_tensors="pt"
    )
    with torch.no_grad():
        token_embeddings = _semantic_model(**tokens).last_hidden_state
        attention_mask = tokens["attention_mask"].unsqueeze(-1).expand(token_embeddings.size())
        mask = attention_mask.to(token_embeddings.dtype)
        embeddings = (token_embeddings * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
        return torch.nn.functional.normalize(embeddings, p=2, dim=1)


def _load_semantic_classifier():
    global _semantic_tokenizer, _semantic_model, _category_embeddings

    if _category_embeddings is None:
        if not HAS_TRANSFORMERS:
            raise RuntimeError("Transformers and PyTorch are required for semantic classification")
        _semantic_tokenizer = AutoTokenizer.from_pretrained(_CATEGORY_MODEL_NAME)
        _semantic_model = AutoModel.from_pretrained(_CATEGORY_MODEL_NAME)
        _semantic_model.eval()
        labels = list(_CATEGORY_DESCRIPTIONS)
        descriptions = [_CATEGORY_DESCRIPTIONS[label] for label in labels]
        _category_embeddings = (labels, _encode_semantic_texts(descriptions))

    return _category_embeddings


def _split_into_chunks(text, chunk_size=120, overlap=20):
    words = text.split()
    if len(words) <= chunk_size:
        return [text]

    step = chunk_size - overlap
    return [" ".join(words[index:index + chunk_size]) for index in range(0, len(words), step)]


def _classify_category_semantically(text):
    labels, category_embeddings = _load_semantic_classifier()
    chunks = _split_into_chunks(text)
    chunk_embeddings = _encode_semantic_texts(chunks)
    similarities = chunk_embeddings @ category_embeddings.T
    top_count = min(3, len(chunks))
    category_scores = similarities.topk(top_count, dim=0).values.mean(dim=0)
    return labels[int(category_scores.argmax().item())]


def _classify_category_by_keywords(text):
    text_lower = text.lower()

    category_keywords = {
        "Safety Circular": ["safety", "circular", "safe", "hazard", "warning", "precaution"],
        "Invoice": ["invoice", "bill", "payment", "amount", "total", "rupees", "price"],
        "Legal Notice": ["notice", "legal", "court", "law", "attorney", "sue", "plaintiff"],
        "Technical Report": ["technical", "system", "software", "hardware", "support", "issue"],
        "Employee Info": ["employee", "staff", "hr", "personnel", "human resource"],
        "Report": ["report", "analysis", "finding", "conclusion", "analysis"],
        "Schedule": ["schedule", "maintenance", "date", "time", "appointment"]
    }
    
    scores = {}
    for category, keywords in category_keywords.items():
        score = sum(text_lower.count(keyword) for keyword in keywords)
        scores[category] = score
    
    if not scores or max(scores.values()) == 0:
        return "General Document"
    return max(scores, key=scores.get)


def classify_category(text):
    """Classify a document by semantic similarity to pretrained category embeddings."""
    if not text or not text.strip():
        return "General Document"

    try:
        best_category = _classify_category_semantically(text)
    except Exception as error:
        logging.warning("Semantic classification unavailable; using keyword fallback: %s", error)
        best_category = _classify_category_by_keywords(text)

    logging.info("Classified as: %s", best_category)
    return best_category


# -------------------------------------------------
# DEPARTMENT MAPPING
# -------------------------------------------------
def map_department(category):
    """Map category to department"""
    department_map = {
        "Safety Circular": "Safety & Compliance",
        "Invoice": "Finance",
        "Legal Notice": "Legal",
        "Technical Report": "IT/Technical",
        "Employee Info": "HR",
        "Report": "Management",
        "Schedule": "Operations"
    }
    
    return department_map.get(category, "General")


# -------------------------------------------------
# DEADLINE EXTRACTION
# -------------------------------------------------
def extract_deadline(text):
    """Extract deadline from text"""
    
    # Look for date patterns
    date_patterns = [
        r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s*\d{4})?\b',
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',
        r'\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b'
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0)
    
    # Look for relative dates
    if 'within' in text.lower():
        within_match = re.search(r'within\s+(\d+)\s+(days?|weeks?|months?)', text, re.IGNORECASE)
        if within_match:
            return f"Within {within_match.group(1)} {within_match.group(2)}"
    
    return "Not specified"


# -------------------------------------------------
# ACTION ITEMS EXTRACTION
# -------------------------------------------------
def extract_action_items(text):
    """Extract action items"""
    
    action_keywords = [
        'must', 'should', 'please', 'required', 'need to', 'action',
        'implement', 'complete', 'submit', 'approve', 'review',
        'follow', 'ensure', 'verify', 'check', 'inform'
    ]
    
    sentences = [s.strip() for s in re.split(r'[.!?]\s+', text) if s.strip()]
    action_items = []
    
    for sentence in sentences:
        sent_lower = sentence.lower()
        if any(keyword in sent_lower for keyword in action_keywords):
            action_items.append(sentence[:100])  # Limit length
    
    return action_items[:5] if action_items else ["Review document for requirements"]


# -------------------------------------------------
# KEYWORD EXTRACTION
# -------------------------------------------------
def extract_keywords(text):
    """Extract important keywords"""
    
    # Remove common words
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'i',
        'you', 'he', 'she', 'it', 'we', 'they', 'is', 'are', 'am', 'be',
        'been', 'have', 'has', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'can', 'that', 'this', 'these', 'those'
    }
    
    # Extract words
    words = re.findall(r'\b[a-z]{4,}\b', text.lower())
    
    # Count words
    word_freq = Counter(words)
    
    # Remove stop words and get top keywords
    keywords = [word for word, _ in word_freq.most_common(10) if word not in stop_words]
    
    return keywords[:5]


# -------------------------------------------------
# ADVANCED SUMMARIZATION WITH KEY POINTS
# -------------------------------------------------
def generate_executive_summary(text):
    """Generate 1-page executive summary with key points"""
    if not text or len(text.strip()) < 50:
        return {"summary": text or "No content", "key_points": []}
    
    sentences = [s.strip() for s in re.split(r'[.!?]\s+', text) if s.strip() and len(s.strip()) > 10]
    
    if len(sentences) == 0:
        return {"summary": text[:500], "key_points": []}
    
    # Extract key points (sentences with important keywords)
    importance_keywords = ['important', 'critical', 'urgent', 'must', 'required', 'deadline', 
                          'approval', 'decision', 'action', 'issue', 'risk', 'compliance']
    
    key_sentences = []
    for sent in sentences:
        if any(kw in sent.lower() for kw in importance_keywords):
            key_sentences.append(sent[:150])
    
    # Build summary: opening + key points + closing
    summary_parts = [sentences[0]]  # Opening
    
    if key_sentences:
        summary_parts.extend(key_sentences[:3])  # Top 3 key points
    else:
        summary_parts.extend(sentences[1:min(4, len(sentences))])
    
    if len(sentences) > 1 and sentences[-1] not in summary_parts:
        summary_parts.append(sentences[-1])  # Closing
    
    summary_text = ' '.join(summary_parts)
    if len(summary_text) > 500:
        summary_text = summary_text[:500] + "..."
    
    return {
        "summary": summary_text,
        "key_points": key_sentences[:5] if key_sentences else sentences[:3]
    }


# -------------------------------------------------
# FINANCIAL DATA EXTRACTION
# -------------------------------------------------
def extract_financial_data(text):
    """Extract amounts, currencies, financial terms"""
    financial_data = {
        "amounts": [],
        "currencies": [],
        "financial_terms": []
    }
    
    # Currency patterns
    currency_patterns = [
        (r'₹\s*([\d,]+(?:\.\d{2})?)', '₹'),
        (r'\$\s*([\d,]+(?:\.\d{2})?)', '$'),
        (r'USD\s*([\d,]+(?:\.\d{2})?)', 'USD'),
        (r'EUR\s*([\d,]+(?:\.\d{2})?)', 'EUR'),
        (r'([\d,]+(?:\.\d{2})?)\s*(?:rupees|dollars|euros)', 'Various')
    ]
    
    for pattern, currency in currency_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            financial_data["amounts"].append({"value": match, "currency": currency})
    
    # Financial terms
    financial_terms = ['payment', 'invoice', 'cost', 'budget', 'expense', 'revenue', 
                      'profit', 'loss', 'discount', 'tax', 'fee', 'rate']
    for term in financial_terms:
        if term in text.lower():
            financial_data["financial_terms"].append(term)
    
    return financial_data


# -------------------------------------------------
# DECISION AND COMMITMENT EXTRACTION
# -------------------------------------------------
def extract_decisions_commitments(text):
    """Extract decisions, commitments, and action items"""
    decisions = {
        "decisions": [],
        "commitments": [],
        "risks": []
    }
    
    sentences = [s.strip() for s in re.split(r'[.!?]\s+', text) if s.strip()]
    
    decision_keywords = ['decided', 'decision', 'agreed', 'approved', 'approved', 'authorized']
    commitment_keywords = ['will', 'ensure', 'commit', 'guarantee', 'promise', 'undertake']
    risk_keywords = ['risk', 'danger', 'hazard', 'threat', 'issue', 'problem', 'concern', 'failure']
    
    for sentence in sentences:
        sent_lower = sentence.lower()
        
        if any(kw in sent_lower for kw in decision_keywords):
            decisions["decisions"].append(sentence[:120])
        
        if any(kw in sent_lower for kw in commitment_keywords):
            decisions["commitments"].append(sentence[:120])
        
        if any(kw in sent_lower for kw in risk_keywords):
            decisions["risks"].append(sentence[:120])
    
    return {
        "decisions": decisions["decisions"][:3],
        "commitments": decisions["commitments"][:3],
        "risks": decisions["risks"][:3]
    }


# -------------------------------------------------
# COMPLIANCE AND REGULATORY KEYWORDS
# -------------------------------------------------
def check_compliance_flags(text):
    """Check for compliance and regulatory keywords"""
    compliance_flags = {
        "has_compliance_terms": False,
        "has_regulatory_keywords": False,
        "urgency_level": "Normal",
        "departments_affected": []
    }
    
    compliance_keywords = ['comply', 'compliance', 'regulation', 'regulatory', 'audit',
                          'standard', 'certification', 'conformance', 'policy', 'procedure',
                          'guideline', 'requirement', 'mandate', 'directive']
    
    urgency_keywords = {
        "Critical": ['emergency', 'critical', 'immediately', 'urgent', 'asap', 'halt', 'stop'],
        "High": ['important', 'priority', 'expedite', 'accelerate', 'within 48 hours'],
        "Medium": ['soon', 'within week', 'schedule', 'plan'],
        "Normal": []
    }
    
    text_lower = text.lower()
    
    if any(kw in text_lower for kw in compliance_keywords):
        compliance_flags["has_compliance_terms"] = True
    
    regulatory_bodies = {
        'CMRS': "Commissioner of Metro Rail Safety",
        'MHUPA': "Ministry of Housing & Urban Affairs",
        'MoHUA': "Ministry of Housing & Urban Affairs",
        'ISO': "International Standards Organization",
        'NFPA': "National Fire Protection Association"
    }
    
    for code, name in regulatory_bodies.items():
        if code.lower() in text_lower or name.lower() in text_lower:
            compliance_flags["has_regulatory_keywords"] = True
    
    for level, keywords in urgency_keywords.items():
        if any(kw in text_lower for kw in keywords):
            compliance_flags["urgency_level"] = level
            break
    
    # Department keywords
    dept_keywords = {
        "Safety & Compliance": ["safety", "hazard", "accident", "incident", "compliance"],
        "Finance": ["payment", "budget", "cost", "invoice", "expense"],
        "Operations": ["maintenance", "schedule", "shift", "operation", "availability"],
        "Legal": ["law", "contract", "liability", "litigation", "court"],
        "Infrastructure": ["equipment", "system", "infrastructure", "technology", "network"]
    }
    
    for dept, keywords in dept_keywords.items():
        if any(kw in text_lower for kw in keywords):
            compliance_flags["departments_affected"].append(dept)
    
    return compliance_flags


# -------------------------------------------------
# SMART ROUTING LOGIC
# -------------------------------------------------
def determine_recipients(category, department, compliance_flags):
    """Determine who should receive this document"""
    routing_rules = {
        "Safety Circular": ["Safety & Compliance", "Operations", "Management"],
        "Invoice": ["Finance", "Operations"],
        "Legal Notice": ["Legal", "Management"],
        "Technical Report": ["IT/Technical", "Infrastructure", "Management"],
        "Employee Info": ["HR", "Management"],
        "Report": ["Management"],
        "Schedule": ["Operations", "Infrastructure"]
    }
    
    base_recipients = routing_rules.get(category, [department])
    
    # Add management if high urgency or compliance issue
    if compliance_flags.get("urgency_level") in ["Critical", "High"]:
        if "Management" not in base_recipients:
            base_recipients.append("Management")
    
    if compliance_flags.get("has_regulatory_keywords"):
        if "Legal" not in base_recipients:
            base_recipients.append("Legal")
        if "Safety & Compliance" not in base_recipients:
            base_recipients.append("Safety & Compliance")
    
    # Add departments affected by document
    for dept in compliance_flags.get("departments_affected", []):
        if dept not in base_recipients:
            base_recipients.append(dept)
    
    return base_recipients


# -------------------------------------------------
# PREDICTIVE ALERT GENERATION
# -------------------------------------------------
def generate_predictive_alerts(text, category, compliance_flags):
    """Generate predictive alerts based on document content"""
    alerts = []
    
    text_lower = text.lower()
    
    # Check for deadline-related triggers
    if 'deadline' in text_lower or 'due date' in text_lower or 'before' in text_lower:
        alerts.append({
            "type": "deadline_alert",
            "priority": compliance_flags.get("urgency_level", "Normal"),
            "message": "Document contains time-sensitive requirements - verify deadlines"
        })
    
    # Check for decision triggers
    if any(kw in text_lower for kw in ['decision', 'approval', 'authorized', 'agreed']):
        alerts.append({
            "type": "decision_needed",
            "priority": "High",
            "message": "Document contains decisions requiring acknowledgment or action"
        })
    
    # Check for compliance triggers
    if compliance_flags.get("has_regulatory_keywords"):
        alerts.append({
            "type": "compliance_alert",
            "priority": "High",
            "message": "Document references regulatory requirements - ensure audit trail"
        })
    
    # Check for financial triggers
    if 'amount' in text_lower or 'cost' in text_lower or 'payment' in text_lower:
        alerts.append({
            "type": "financial_review",
            "priority": "Medium",
            "message": "Document contains financial information - route to Finance for verification"
        })
    
    # Check for safety triggers
    if any(kw in text_lower for kw in ['safety', 'hazard', 'risk', 'accident', 'incident', 'emergency']):
        alerts.append({
            "type": "safety_alert",
            "priority": "Critical",
            "message": "Document contains safety-related content - immediate review required"
        })
    
    return alerts


# -------------------------------------------------
# MAIN ANALYSIS FUNCTION
# -------------------------------------------------
def analyze_document(text):
    """Analyze a document and return structured information"""
    
    logging.info("Starting document analysis...")
    
    try:
        language = detect_language(text)
        logging.info(f"Language: {language}")
        
        translated_text = translate_to_english(text, language)
        logging.info("Translation complete")
        
        category = classify_category(translated_text)
        logging.info(f"Category: {category}")
        
        department = map_department(category)
        logging.info(f"Department: {department}")
        
        # Executive summary with key points
        summary_data = generate_executive_summary(translated_text)
        
        # Extract intelligence
        deadline = extract_deadline(translated_text)
        actions = extract_action_items(translated_text)
        keywords = extract_keywords(translated_text)
        financial = extract_financial_data(translated_text)
        decisions = extract_decisions_commitments(translated_text)
        
        # Compliance check
        compliance_flags = check_compliance_flags(translated_text)
        
        # Smart routing
        recipients = determine_recipients(category, department, compliance_flags)
        
        # Predictive alerts
        alerts = generate_predictive_alerts(translated_text, category, compliance_flags)
        
        result = {
            "summary": summary_data["summary"],
            "key_points": summary_data["key_points"],
            "language": language,
            "category": category,
            "department": department,
            "deadline": deadline,
            "actions": actions,
            "keywords": keywords,
            "financial_data": financial,
            "decisions_commitments": decisions,
            "compliance_flags": compliance_flags,
            "routing_recipients": recipients,
            "predictive_alerts": alerts
        }
        
        logging.info("Document analysis complete")
        return result
        
    except Exception as e:
        logging.error(f"Analysis failed: {e}", exc_info=True)
        return {
            "summary": text[:200],
            "key_points": [],
            "language": "unknown",
            "category": "General Document",
            "department": "General",
            "deadline": "Not specified",
            "actions": [],
            "keywords": [],
            "financial_data": {"amounts": [], "currencies": [], "financial_terms": []},
            "decisions_commitments": {"decisions": [], "commitments": [], "risks": []},
            "compliance_flags": {"has_compliance_terms": False, "has_regulatory_keywords": False, "urgency_level": "Normal", "departments_affected": []},
            "routing_recipients": [],
            "predictive_alerts": []
        }
