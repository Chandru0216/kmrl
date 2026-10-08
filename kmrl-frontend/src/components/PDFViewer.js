import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import API, { apiFetch } from "../api";

export default function PDFViewer({ doc, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [translatingContent, setTranslatingContent] = useState(null);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Extract just the filename from the path
  const filename =
    doc.path.includes("/") || doc.path.includes("\\")
      ? doc.path.split(/[\\/]/).pop()
      : doc.path;

  const fileUrl = `${API}/uploads/${filename}`;
  const fileExt = filename.split(".").pop().toLowerCase();

  // Load text files
  useEffect(() => {
    if (fileExt === "txt") {
      apiFetch(fileUrl, { mode: "cors" })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          setFileContent(text);
          setLoading(false);
        })
        .catch((err) => {
          setError(true);
          setLoading(false);
          console.error("Text load error:", err, "URL:", fileUrl);
        });
    } else {
      setLoading(false);
    }
  }, [fileExt, fileUrl]);

  // Translate content to English
  const handleTranslate = async () => {
    if (isTranslated || !fileContent) return;

    setTranslating(true);
    try {
      const res = await apiFetch(`${API}/translate`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fileContent,
          source_language: doc.language || "auto",
          target_language: "English",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTranslatingContent(data.translated_text);
        setIsTranslated(true);
      } else {
        const errorData = await res.json();
        console.error("Translation API error:", errorData);
        alert("Translation failed: " + (errorData.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Translation error:", err);
      alert("Translation error: " + err.message);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "20px",
      }}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "900px",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#1e293b", fontSize: "18px" }}>
              📄 {doc.filename}
            </h2>
            <p
              style={{
                margin: "4px 0 0 0",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              {doc.department} • {doc.category}{" "}
              {doc.language && doc.language.toUpperCase() !== "ENGLISH" && (
                <span
                  style={{
                    display: "inline-block",
                    marginLeft: "10px",
                    padding: "2px 8px",
                    background: "#3b82f6",
                    color: "white",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "700",
                  }}
                >
                  🌐 {doc.language?.toUpperCase()}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>

        {/* Translation Bar */}
        {fileExt === "txt" &&
          fileContent &&
          doc.language &&
          doc.language.toUpperCase() !== "ENGLISH" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #1e40af",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "white",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                💬 This document is in {doc.language?.toUpperCase()}. Would you
                like to translate it to English?
              </p>
              {!isTranslated && (
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  style={{
                    background: "white",
                    color: "#2563eb",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: translating ? "not-allowed" : "pointer",
                    opacity: translating ? 0.7 : 1,
                  }}
                >
                  {translating
                    ? "🔄 Translating..."
                    : "🌐 Translate to English"}
                </button>
              )}
              {isTranslated && (
                <span
                  style={{
                    background: "#ffffff20",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: "600",
                    fontSize: "13px",
                  }}
                >
                  ✓ Showing English version
                </span>
              )}
            </motion.div>
          )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            position: "relative",
            background: fileExt === "txt" ? "#1e293b" : "#ffffff",
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "#64748b",
              }}
            >
              📥 Loading file...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "20px",
                background: "#fee2e2",
                color: "#991b1b",
                borderRadius: "8px",
                margin: "20px",
                fontSize: "13px",
              }}
            >
              <div>⚠️ Could not load file</div>
              <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}>
                File: <code>{filename}</code>
              </div>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#991b1b",
                  textDecoration: "underline",
                  marginTop: "10px",
                  display: "inline-block",
                }}
              >
                Try downloading instead →
              </a>
            </div>
          )}

          {/* Text File Viewer */}
          {fileExt === "txt" &&
            (isTranslated ? translatingContent : fileContent) && (
              <pre
                style={{
                  padding: "20px",
                  margin: 0,
                  fontFamily: "monospace",
                  fontSize: "13px",
                  color: "#e2e8f0",
                  whiteSpace: "pre-wrap",
                  wordWrap: "break-word",
                  lineHeight: "1.6",
                }}
              >
                {isTranslated ? translatingContent : fileContent}
              </pre>
            )}

          {/* Image Viewer */}
          {["png", "jpg", "jpeg"].includes(fileExt) && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: "100%",
                background: "#f1f5f9",
              }}
            >
              <img
                src={fileUrl}
                alt={filename}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setError(true);
                  setLoading(false);
                }}
              />
            </div>
          )}

          {/* PDF Viewer */}
          {fileExt === "pdf" && (
            <iframe
              src={fileUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
              title="PDF Viewer"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "15px 20px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
            Status: <strong>{doc.status}</strong> • Uploaded: {doc.uploaded_at}
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <a
              href={`${API}/download/${filename}`}
              download
              style={{
                background: "#667eea",
                color: "white",
                padding: "10px 16px",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                border: "none",
                transition: "0.2s ease",
              }}
            >
              ⬇️ Download
            </a>
            <button
              onClick={onClose}
              style={{
                background: "#e2e8f0",
                color: "#1e293b",
                padding: "10px 16px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                border: "none",
                transition: "0.2s ease",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#cbd5e1")}
              onMouseLeave={(e) => (e.target.style.background = "#e2e8f0")}
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
