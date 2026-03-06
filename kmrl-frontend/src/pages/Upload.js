import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://127.0.0.1:5000";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_TIMEOUT = 120000; // 2 minutes for AI processing

export default function Upload({ user }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  const handleFileSelect = (selectedFile) => {
    setError(null);
    setUploadedFile(null);
    console.log(
      "File selected:",
      selectedFile?.name,
      selectedFile?.type,
      selectedFile?.size,
    );

    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setFile(null);
      console.error("Invalid file type:", selectedFile.type);
      return setError("Only PDF files are allowed.");
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      console.error("File too large:", selectedFile.size);
      return setError("File size must be under 10MB.");
    }

    console.log("File accepted, setting state");
    setFile(selectedFile);
  };

  const uploadFile = async () => {
    console.log("uploadFile called, file state:", file);

    if (!file) {
      console.error("No file selected");
      return setError("Please select a file first.");
    }

    try {
      setLoading(true);
      setError(null);
      console.log("Starting upload for:", file.name);

      const formData = new FormData();
      formData.append("file", file);

      // Create abort controller with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

      const res = await fetch(`${API}/upload`, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await res.json();

      setUploadedFile(data);
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error(err);
      if (err.name === "AbortError") {
        setError(
          "Upload took too long. The AI models might still be loading. Please try again.",
        );
      } else {
        setError(err.message || "Upload failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-area">
      <h2 className="section-header">📤 Upload Document</h2>

      <div
        className={`upload-box ${file ? "file-selected" : ""}`}
        style={{
          padding: "40px",
          textAlign: "center",
          backgroundColor: "#ffffff",
          border: "2px dashed #e2e8f0",
          borderRadius: "14px",
          transition: "all 0.3s ease",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          disabled={loading}
          onChange={(e) => handleFileSelect(e.target.files[0])}
          style={{
            display: "block",
            margin: "0 auto 20px",
            padding: "10px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        />

        {file && (
          <p
            className="selected-file"
            style={{
              fontSize: "16px",
              color: "#16a34a",
              marginBottom: "20px",
              fontWeight: "600",
            }}
          >
            ✅ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}

        <button
          onClick={uploadFile}
          disabled={loading || !file}
          style={{
            padding: "12px 28px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: loading || !file ? "not-allowed" : "pointer",
            opacity: loading || !file ? 0.6 : 1,
          }}
        >
          {loading ? "⏳ Processing with AI..." : "📤 Upload File"}
        </button>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: "25px",
              padding: "20px",
              backgroundColor: "#f0f9ff",
              borderRadius: "8px",
            }}
          >
            <p
              style={{
                fontSize: "14px",
                color: "#0284c7",
                marginBottom: "10px",
              }}
            >
              🧠 AI is analyzing your document...
            </p>
            <p style={{ fontSize: "12px", color: "#0284c7" }}>
              This may take 30-120 seconds on first upload (models loading)
            </p>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1 }}
              style={{ display: "inline-block", marginTop: "10px" }}
            >
              ⚙️
            </motion.div>
          </motion.div>
        )}

        {error && (
          <p
            className="error-message"
            style={{ color: "#dc2626", marginTop: "20px", fontWeight: "600" }}
          >
            ❌ {error}
          </p>
        )}
      </div>

      <AnimatePresence>
        {uploadedFile && (
          <motion.div
            className="documents-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h2 className="section-header">✅ Upload Successful</h2>

            <div className="document-card">
              <h3>{uploadedFile.filename}</h3>

              {uploadedFile.language && uploadedFile.language !== "unknown" && (
                <div className="language-info">
                  🌐 Detected Language:{" "}
                  <b>{uploadedFile.language.toUpperCase()}</b>
                  {uploadedFile.language !== "en" &&
                    " (Auto-translated to English for analysis)"}
                </div>
              )}

              <p>
                <b>Summary:</b> {uploadedFile.summary}
              </p>
              <p>
                <b>Category:</b> {uploadedFile.category}
              </p>
              <p>
                <b>Department:</b> {uploadedFile.department}
              </p>
              <p>
                <b>Deadline:</b> {uploadedFile.deadline || "Not detected"}
              </p>
              <p>
                <b>Keywords:</b> {uploadedFile.keywords?.join(", ") || "N/A"}
              </p>

              <p>
                <b>Action Items:</b>
              </p>
              <ul>
                {Array.isArray(uploadedFile?.action) &&
                uploadedFile.action.length > 0 ? (
                  uploadedFile.action.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))
                ) : (
                  <li>No specific actions detected</li>
                )}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
