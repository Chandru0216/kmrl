# Document Routing Engine - Deployment & Testing Guide

## ⚡ Quick Start (5 Minutes)

### Prerequisites

- Python 3.8+
- Node.js 14+
- MongoDB running locally
- Tesseract OCR installed
- Poppler PDF tools installed

### Step 1: Start Backend

```bash
cd c:\Users\chand\Desktop\kmrl\backend
python app.py
```

✅ Backend running on `http://localhost:5000`

### Step 2: Start Frontend

```bash
cd c:\Users\chand\Desktop\kmrl\kmrl-frontend
npm start
```

✅ Frontend running on `http://localhost:3000`

### Step 3: Access Application

1. Open browser: `http://localhost:3000`
2. Login with any email/password
3. Navigate through the new features

---

## 🧪 Testing the Six New Features

### Prerequisite: Upload Sample Data

If database is empty, run:

```bash
cd c:\Users\chand\Desktop\kmrl\backend
python upload_samples.py
```

### Automated Test Suite

Run comprehensive tests:

```bash
cd c:\Users\chand\Desktop\kmrl\backend
python test_integration.py
```

This tests:

- ✅ AI Summarization Engine
- ✅ Content Intelligence
- ✅ Compliance Check
- ✅ Smart Routing
- ✅ Predictive Alerts
- ✅ Compliance Dashboard
- ✅ Alert Center

---

## 📋 Manual Testing Checklist

### 1️⃣ AI Summarization Engine

**Test**: Dashboard → View any document summary

```
Expected:
- 1-page summary visible
- Key points listed
- No errors in console
```

**API Test**:

```bash
# Get document ID from /documents endpoint
curl http://localhost:5000/summarize/{doc_id}
```

---

### 2️⃣ Smart Routing

**Test**: Documents page → View any document Intelligence

```
Expected:
- Routing recipients shown
- 2-4 departments listed
- Logic appears correct for document type
```

**API Test**:

```bash
curl http://localhost:5000/route-document/{doc_id}
```

---

### 3️⃣ Content Intelligence

**Test**: Documents page → 🧠 Intelligence button

```
Expected:
- Intelligence modal opens
- 5 tabs visible (Overview, Financial, Decisions, Actions, Keywords)
- Data extracted correctly
```

**API Test**:

```bash
curl http://localhost:5000/extract-intelligence/{doc_id}
```

---

### 4️⃣ Compliance Dashboard

**Test**: Sidebar → 📜 Compliance

```
Expected:
- 4 metric cards visible (Compliance Terms, Regulatory, Critical, High)
- Department risk cards shown
- Compliance tracker list displayed
- Expandable items show details
```

**API Test**:

```bash
curl http://localhost:5000/compliance-dashboard
```

---

### 5️⃣ Alert Center

**Test**: Sidebar → 🔔 Alerts

```
Expected:
- Alert stats visible at top
- Filter options working (type, priority)
- Alerts listed with icons and severity colors
- "View" buttons functional
```

**API Test**:

```bash
curl http://localhost:5000/alert-center
```

---

### 6️⃣ Predictive Alerts

**Test**: Documents page → View 🚨 safety documents

```
Expected:
- Different alert types for different documents
- Priorities correctly assigned
- Messages are relevant
```

**API Test**:

```bash
curl http://localhost:5000/predictive-alerts/{doc_id}
```

---

## 🔌 Source Integration Testing

### Email Import

```bash
# Set these in backend/.env locally or in the Render service environment
set IMAP_HOST=imap.gmail.com
set EMAIL_ADDRESS=your-email@gmail.com
set EMAIL_PASSWORD=your-gmail-app-password
```

For Gmail, enable IMAP and use an App Password rather than your normal account password. Restart the backend after setting these values. From the signed-in dashboard, click **Sync email**. It checks the latest 100 Inbox messages, imports supported PDF/TXT/PNG/JPG attachments up to 10 MB, analyzes them like manual uploads, and skips attachments already imported. Sync is on demand; it does not poll continuously. The API endpoint `POST /sync-source/email` requires a valid bearer token.

### Maximo Import

```bash
# Set environment variables
set MAXIMO_URL=https://your-maximo.com/api
set MAXIMO_TOKEN=your-token

# Test sync
curl -X POST http://localhost:5000/sync-source/maximo
```

### SharePoint Import

```bash
# Set environment variables
set SHAREPOINT_CLIENT_ID=your-id
set SHAREPOINT_CLIENT_SECRET=your-secret
set SHAREPOINT_TENANT=your-tenant
set SHAREPOINT_SITE_ID=your-site
set SHAREPOINT_DRIVE_ID=your-drive

# Test sync
curl -X POST http://localhost:5000/sync-source/sharepoint
```

---

## 📊 Expected System Metrics

### Performance Baselines

| Operation                 | Expected Time | Status |
| ------------------------- | ------------- | ------ |
| Load Dashboard            | <1s           | ✅     |
| View Summary              | <2s           | ✅     |
| Extract Intelligence      | <2s           | ✅     |
| Load Compliance Dashboard | <3s           | ✅     |
| Load Alert Center         | <2s           | ✅     |
| Sync 100 emails           | <30s          | ✅     |
| Sync 50 Maximo WOs        | <60s          | ✅     |

### Database Statistics

- **Documents**: 28+ test documents
- **Summaries**: 100% generated
- **Intelligence Extracts**: 100% available
- **Compliance Flags**: 100% checked
- **Alerts**: 50-100+ generated

---

## ✅ Validation Checklist

**Frontend**:

- [ ] Dashboard displays all stats
- [ ] Can navigate to all 5 new pages
- [ ] Compliance Dashboard shows metrics
- [ ] Alert Center displays filtered alerts
- [ ] Intelligence View shows data
- [ ] No 404 or 500 errors

**Backend**:

- [ ] All 7 new endpoints respond
- [ ] No errors in console logs
- [ ] MongoDB queries execute correctly
- [ ] Response times < 3s
- [ ] All documents have required fields

**Data Quality**:

- [ ] Summaries are coherent
- [ ] Financial data extracted correctly
- [ ] Decisions identified properly
- [ ] Compliance flags appropriate
- [ ] Routing logic makes sense
- [ ] Alerts are actionable

---

## 🔍 Troubleshooting

### Issue: Backend fails to start

```bash
# Check Python dependencies
pip install -r requirements.txt

# Check MongoDB connection
python -c "from pymongo import MongoClient; print('MongoDB OK' if MongoClient().server_info() else 'Failed')"

# Check port 5000 availability
netstat -ano | findstr :5000
```

### Issue: Frontend compilation errors

```bash
cd kmrl-frontend
npm install
npm start
```

### Issue: No documents in database

```bash
cd backend
python upload_samples.py
```

### Issue: API returns 500 errors

```bash
# Check backend logs
tail backend.log

# Restart backend
python app.py
```

### Issue: Features not appearing in UI

```
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check frontend console (F12)
4. Verify components are imported in App.js
```

---

## 📈 Performance Optimization

### For Production

```python
# app.py configuration
app.run(debug=False)  # Disable debug mode
app.config['JSON_SORT_KEYS'] = False
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 3600

# Use gunicorn instead
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Frontend Production Build

```bash
npm run build
# Serves optimized build from build/ directory
```

---

## 🔐 Security Checklist

- [ ] Environment variables not hardcoded
- [ ] API endpoints validate input
- [ ] MongoDB injection prevention
- [ ] CORS properly configured
- [ ] File uploads sanitized
- [ ] Error messages don't leak sensitive info

---

## 📚 Documentation Structure

```
├── INTEGRATION_GUIDE.md          (Feature explanations)
├── DEPLOYMENT_GUIDE.md           (This file - setup & testing)
├── API_REFERENCE.md              (Endpoint docs)
├── TROUBLESHOOTING.md            (Common issues)
└── ARCHITECTURE.md               (System design)
```

---

## 🎯 Next Steps

### Phase 1: Testing (Current)

- Run test_integration.py
- Verify all tests pass
- Check performance metrics

### Phase 2: Production Deployment

- Deploy backend to cloud (AWS/Azure/GCP)
- Deploy frontend to CDN
- Configure SSL certificates
- Setup monitoring and logging

### Phase 3: User Training

- Conduct demos for stakeholders
- Create video tutorials
- Develop user manuals
- Setup support ticketing

---

## 📞 Support Resources

**Backend Issues**:

- Check `backend.log`
- Run `python test_integration.py`
- Check MongoDB connection

**Frontend Issues**:

- Open DevTools (F12)
- Check Console for errors
- Check Network tab for API calls

**Integration Issues**:

- Verify environment variables
- Check source credentials
- Test connectivity to external systems

---

## ✨ Success Criteria

Your system is production-ready when:

- ✅ All 7 endpoints return 200 status
- ✅ Test suite shows 7/7 passing (or N/A for No Docs)
- ✅ Frontend loads without errors
- ✅ All 5 pages accessible from navigation
- ✅ All data displays correctly
- ✅ No console errors

---

**Status**: Ready for Testing  
**Date**: February 20, 2026  
**Version**: 2.0 Enterprise Edition

## Render and Vercel Deployment

The backend requires MongoDB, a signing secret, an invite code, and an exact frontend origin in production. It will not start if MongoDB is unavailable, the signing secret is missing, CORS is wildcard/empty, or the unique user email index cannot be created.

1. Rotate the MongoDB database user's password, update `backend/.env`, and keep the connection string private.
2. Review and commit only the intended workspace changes, then push them to the GitHub repository connected to Render and Vercel.
3. Import the repository in Vercel with Root Directory `kmrl-frontend`. The first build can use the default local API URL; note the deployed Vercel origin.
4. Create the Render Blueprint from `render.yaml`. Set `MONGO_URI` to the rotated connection string and `REGISTRATION_CODE` to a strong private invite code. Render generates `AUTH_SECRET` from the blueprint. Set `CORS_ORIGINS` to the exact Vercel origin, without a trailing slash.
5. After Render deploys, set Vercel's `REACT_APP_API_URL` to the Render service URL and redeploy the frontend.
6. Register with the invite code and a password of at least 12 characters. All authenticated accounts currently share access to the same document collection.

To enable email sync on Render, also set `EMAIL_ADDRESS` and `EMAIL_PASSWORD`; `IMAP_HOST` defaults to Gmail and can be changed for another IMAP provider.

The Render blueprint provisions a persistent upload disk on the paid Starter plan. Store deployment secrets in the provider's environment settings, not in source control. Login tokens expire after eight hours; logging out or closing the browser session removes the browser-held token.

### Manual Render Web Service (without a Blueprint)

Create a Web Service from the GitHub repository and select the Docker runtime. Set the Dockerfile path to `Dockerfile` and the Docker context directory to `.` (the repository root). The root Dockerfile builds the backend from `backend/` and installs its OCR system dependencies. Configure the same environment variables listed above, set the health check path to `/health`, and attach a persistent disk at `/app/uploads` if uploaded files must survive redeploys.
