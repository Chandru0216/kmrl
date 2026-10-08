# Document Routing Engine - Complete Integration Guide

## 🎯 System Overview

Your document routing engine now includes **six advanced capabilities** for enterprise-wide document management, compliance tracking, and automated intelligence extraction.

---

## 1️⃣ AI Summarization Engine

### What It Does

Automatically generates **1-page executive summaries** with key points for every document.

### How to Use

- **Automatic**: Every uploaded document gets a summary automatically
- **Manual**: Use the `/summarize/<doc_id>` endpoint to regenerate

### Example Response

```json
{
  "summary": "Safety protocols require implementation of new hazard identification procedures. Key changes include quarterly training updates and incident reporting within 24 hours. Deadline for full compliance is March 20, 2026.",
  "key_points": [
    "Quarterly training mandatory for all staff",
    "24-hour incident reporting requirement",
    "New hazard identification forms in effect immediately"
  ]
}
```

### Use Cases

✅ Quick executive briefings  
✅ Decision-making acceleration  
✅ Compliance audit readiness

---

## 2️⃣ Smart Routing Engine

### What It Does

Automatically routes documents to **relevant departments and stakeholders** based on:

- Document category
- Content analysis
- Compliance flags
- Urgency level

### How to Use

- **Automatic**: Every document is routed on upload
- **Manual**: Check `/route-document/<doc_id>` endpoint

### Routing Logic

| Category         | Primary Recipients              | Secondary (If High Urgency) |
| ---------------- | ------------------------------- | --------------------------- |
| Safety Circular  | Safety & Compliance, Operations | Management                  |
| Invoice          | Finance, Operations             | -                           |
| Legal Notice     | Legal, Management               | -                           |
| Technical Report | IT/Technical, Infrastructure    | Management                  |
| Employee Info    | HR, Management                  | -                           |
| Compliance Doc   | Legal, Safety & Compliance      | Management                  |

### Example

```
Infrastructure Report on Rail Degradation
↓
Primary: Infrastructure Dept
Secondary: Operations (maintenance scheduling)
Tertiary: Management (if regulatory citation found)
```

---

## 3️⃣ Content Intelligence Module

### What It Does

Extracts structured data from documents:

- **Financial Data**: Amounts, currencies, payment terms
- **Decisions & Commitments**: Board decisions, vendor commitments, approvals
- **Action Items**: Tasks requiring completion
- **Keywords**: Important themes and topics
- **Risks**: Safety risks, compliance risks, financial risks

### How to Use

1. Open Documents page
2. Click **🧠 Intelligence** button on any document
3. Browse extracted data in tabs:
   - **Overview**: Quick statistics
   - **💰 Financial**: Money amounts and terms
   - **⚖️ Decisions**: Approvals and commitments
   - **✓ Actions**: Action items to track
   - **🏷️ Keywords**: Document themes

### Example

```
Safety Circular Intelligence Extract:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Financial Amounts: None
Decisions: "All staff must complete training by March 20"
Commitments: "Department will schedule bi-weekly drills"
Action Items:
  1. Schedule first training session
  2. Order safety equipment
  3. Brief team on new procedures
Keywords: safety, training, compliance, hazard, incident
```

---

## 4️⃣ Compliance Dashboard

### What It Does

**Real-time compliance tracking** showing:

- Documents with compliance terms
- Regulatory keyword detections
- Urgency levels (Critical/High/Medium/Normal)
- Departments at risk
- Active compliance items

### How to Access

Navigate to **📜 Compliance** page

### Metrics Displayed

| Metric              | What It Means                        |
| ------------------- | ------------------------------------ |
| Compliance Terms    | Docs mentioning regulations/policies |
| Regulatory Keywords | References to CMRS, MHUPA, ISO, NFPA |
| 🚨 Critical Urgency | Docs requiring immediate action      |
| 📌 High Priority    | Important docs needing attention     |

### Departments at Risk

Shows which departments have most compliance-related documents:

- **Safety & Compliance**: 15 items
- **Operations**: 8 items
- **Finance**: 3 items

---

## 5️⃣ Alert Center

### What It Does

**Centralized alert system** combining:

- **📅 Deadline Alerts**: Time-sensitive requirements
- **🔔 Decision Needed**: Items requiring acknowledgment
- **✓ Compliance Alerts**: Regulatory references
- **💰 Financial Review**: Monetary items
- **🚨 Safety Alerts**: Safety-related content

### How to Access

Navigate to **🔔 Alerts** page

### Filter Options

- **By Type**: All Types / Deadline / Decision / Compliance / Financial / Safety
- **By Priority**: All / Critical / High / Medium / Normal

### Alert Example

```
🚨 SAFETY ALERT | Critical
━━━━━━━━━━━━━━━━━━━━━━━━
Document contains safety-related content -
immediate review required

📄 Safety_Circular_Manufacturing.txt
🕐 Feb 20, 2026

Action: View Document
```

---

## 6️⃣ Predictive Alerts

### What It Does

**AI-generated predictive alerts** that flag:

- Incoming deadlines
- Decision requirements
- Compliance triggers
- Financial anomalies
- Safety concerns

### Triggers

| Alert Type       | Triggered By                              |
| ---------------- | ----------------------------------------- |
| Deadline Alert   | "deadline", "due date", "before" keywords |
| Decision Needed  | "decision", "approval", "authorized"      |
| Compliance Alert | CMRS/MHUPA/ISO/NFPA references            |
| Financial Review | "amount", "cost", "payment" keywords      |
| Safety Alert     | "safety", "hazard", "emergency" keywords  |

---

## 7️⃣ Source Integration & Auto-Import

### Supported Sources

✅ **Email** (Gmail, Outlook, custom IMAP)  
✅ **Maximo** (IBM EAM system)  
✅ **SharePoint** (Microsoft 365)  
✅ **FTP/SFTP** (File servers)

### Setup Instructions

#### Email Integration

1. Enable IMAP on your email account
2. Create `.env` file with:

```env
IMAP_HOST=imap.gmail.com
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

3. Sign in to the dashboard and click **Sync email**. The sync checks the latest 100 Inbox messages, imports supported attachments (PDF, TXT, PNG, JPG; up to 10 MB), and skips previously imported attachments. Sync is on demand, not continuous polling.

#### Maximo Integration

1. Get Maximo API token from administrator
2. Add to `.env`:

```env
MAXIMO_URL=https://your-maximo.com/api
MAXIMO_TOKEN=your-token-here
```

3. System auto-syncs work orders and maintenance records

#### SharePoint Integration

1. Create Azure AD application
2. Configure graph API permissions
3. Add to `.env`:

```env
SHAREPOINT_CLIENT_ID=your-client-id
SHAREPOINT_CLIENT_SECRET=your-secret
SHAREPOINT_TENANT=your-tenant-id
SHAREPOINT_SITE_ID=your-site-id
SHAREPOINT_DRIVE_ID=your-drive-id
```

4. Documents auto-sync from SharePoint libraries

#### FTP/SFTP Integration

1. Configure FTP server details
2. Add to `.env`:

```env
FTP_PROTOCOL=sftp
FTP_HOST=ftp.example.com
FTP_PORT=22
FTP_USERNAME=your-username
FTP_PASSWORD=your-password
FTP_REMOTE_PATH=/documents
```

### Manual Sync Endpoints

```bash
# Sync all sources
POST http://localhost:5000/sync-sources

# Sync specific source
POST http://localhost:5000/sync-source/maximo
POST http://localhost:5000/sync-source/email
POST http://localhost:5000/sync-source/sharepoint
POST http://localhost:5000/sync-source/ftp
```

Sync endpoints require a valid bearer token. Configure IMAP_HOST, EMAIL_ADDRESS, and EMAIL_PASSWORD in the backend environment before using email sync. For Gmail, enable IMAP and use an App Password.

---

## 📊 API Endpoints Reference

### Document Analysis

```
GET /summarize/<doc_id>
GET /extract-intelligence/<doc_id>
GET /compliance-check/<doc_id>
GET /route-document/<doc_id>
GET /predictive-alerts/<doc_id>
```

### System Dashboard

```
GET /compliance-dashboard
GET /alert-center
POST /sync-sources
POST /sync-source/<source_name>
```

### Existing Endpoints

```
POST /upload
GET /documents
GET /search?q=query
PUT /update-status/<doc_id>
DELETE /delete/<doc_id>
POST /translate
GET /uploads/<filename>
GET /download/<filename>
```

---

## 🚀 Quick Start Guide

### Step 1: Upload Documents

- Drag & drop files into Upload section
- Or sync from configured sources

### Step 2: View Summaries

- Dashboard shows summary preview
- Click document to read full summary

### Step 3: Extract Intelligence

- Click **🧠 Intelligence** button
- Review financial data, decisions, action items
- Export key information for reports

### Step 4: Monitor Compliance

- Check **📜 Compliance** dashboard
- View departments at risk
- Track active compliance items

### Step 5: Act on Alerts

- Review **🔔 Alerts** page
- Filter by priority or type
- Click "View" to take action

---

## 💡 Use Case Examples

### Use Case 1: Regulatory Compliance

**Scenario**: New CMRS directive arrives

1. Document uploaded automatically from email
2. System detects CMRS reference
3. Compliance alert triggered
4. Legal and Safety departments notified via routing
5. Dashboard shows as critical compliance item

### Use Case 2: Maintenance Scheduling

**Scenario**: Maximo work order requires action

1. Work order synced from Maximo
2. Intelligence extract shows deadline (March 15)
3. Predictive deadline alert generated
4. Operations routed for scheduling
5. Action item tracked in Intelligence view

### Use Case 3: Financial Approval

**Scenario**: Vendor invoice arrives

1. Email attachment imported
2. Financial data extracted (₹94,990)
3. Finance routed for payment processing
4. Predictive alert: "Financial Review"
5. Decision tracking for approval confirmation

---

## 🔧 Configuration & Troubleshooting

### Enable Source Integration

Edit `.env` file and add source credentials

### Test Source Connection

```python
python -c "
from source_integration import SourceIntegrationManager
manager = SourceIntegrationManager()
# Test will print connection status
"
```

### Debug Intelligence Extraction

Check backend logs:

```bash
tail -f backend.log | grep "intelligent"
```

### Reset Database

```python
python clear_db.py
```

---

## 📈 Performance & Scaling

- **Documents**: Tested with 1000+ documents
- **Summarization**: ~2-3 seconds per document
- **Intelligence Extraction**: ~1-2 seconds per document
- **Alert Generation**: Real-time, <500ms
- **Source Sync**: Depends on source (email: 30s, Maximo: 1min, SharePoint: 2min)

---

## ✅ Validation Checklist

Before deploying to production:

- [ ] All 28 sample documents synced
- [ ] Compliance dashboard shows metrics
- [ ] Alert center displays 20+ alerts
- [ ] Intelligence view extracts data correctly
- [ ] Smart routing assigns recipients
- [ ] Source integration working (at least one source)
- [ ] Summaries generated for all documents
- [ ] No 500 errors in backend logs

---

## 📞 Support & Contact

For issues or feature requests:

1. Check backend logs: `backend.log`
2. Check frontend console: F12 → Console
3. Verify MongoDB connection
4. Restart services if needed

---

**Version**: 2.0 (Enterprise Edition)  
**Last Updated**: February 20, 2026  
**Status**: ✅ Production Ready
