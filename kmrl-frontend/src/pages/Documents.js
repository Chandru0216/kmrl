import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Alert from "../components/Alert";
import PDFViewer from "../components/PDFViewer";
import IntelligenceView from "../components/IntelligenceView";

const API = "http://127.0.0.1:5000";

function Documents({ user }) {
  const location = useLocation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [viewPDF, setViewPDF] = useState(null);
  const [viewIntelligence, setViewIntelligence] = useState(null);

  const fetchDocs = async () => {
    try {
      const url = `${API}/documents`;
      console.log("Fetching documents from:", url);
      const res = await fetch(url, {
        mode: "cors",
        headers: { "Content-Type": "application/json" },
      });

      console.log("Response status:", res.status);

      if (!res.ok) {
        throw new Error(`Documents API failed: ${res.statusText}`);
      }

      const data = await res.json();
      console.log("Fetched documents:", data);
      console.log("Document count:", data ? data.length : 0);
      setDocuments(data && Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch error:", err);
      setAlert({
        message: `Error loading documents: ${err.message}`,
        type: "error",
      });
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    // Handle navigation from AlertCenter or Compliance pages
    console.log("Navigation state check:", {
      hasState: !!location.state,
      docFilename: location.state?.docFilename,
      docsCount: documents.length,
    });

    if (location.state?.docFilename && documents.length > 0) {
      console.log("Looking for document:", location.state.docFilename);
      console.log(
        "Available documents:",
        documents.map((d) => d.filename),
      );

      const targetDoc = documents.find(
        (doc) =>
          doc.filename === location.state.docFilename ||
          doc._id === location.state.docFilename,
      );

      if (targetDoc) {
        console.log(
          "Found target document, opening PDF viewer for:",
          targetDoc.filename,
        );
        // Auto-open PDF viewer for the document (pass full doc object, not just filename)
        setViewPDF(targetDoc);
        // Clear the state so it doesn't keep opening
        window.history.replaceState({}, document.title);
      } else {
        console.log("Target document not found in list");
      }
    }
  }, [documents, location.state]);

  const removeDoc = async (id) => {
    console.log("Remove button clicked for doc:", id);

    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        "🗑️ Are you absolutely sure you want to remove this document?",
      )
    ) {
      console.log("User cancelled deletion");
      return;
    }

    try {
      console.log(`Sending DELETE request to ${API}/delete/${id}`);
      const res = await fetch(`${API}/delete/${id}`, {
        method: "DELETE",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
      });

      console.log("Delete response status:", res.status);
      const responseText = await res.text();
      console.log("Delete response body:", responseText);

      if (res.ok) {
        setAlert({
          message: "✅ Document removed successfully!",
          type: "success",
        });
        console.log("Reloading documents...");
        await fetchDocs();
      } else {
        setAlert({
          message: `Failed to remove document (Status: ${res.status})`,
          type: "error",
        });
      }
    } catch (error) {
      console.error("Delete error:", error);
      setAlert({ message: `Error: ${error.message}`, type: "error" });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)",
        padding: "0",
        margin: "0",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#000000",
          borderBottom: "2px solid #333333",
          padding: "20px 40px",
        }}
      >
        <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
          <h1
            style={{
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: "700",
              margin: "0 0 10px 0",
            }}
          >
            📁 All Documents
          </h1>
          <p style={{ color: "#cccccc", margin: 0, fontSize: "14px" }}>
            Manage and review all documents
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: "40px", maxWidth: "1600px", margin: "0 auto" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#999999" }}>
            ⏳ Loading documents...
          </p>
        ) : documents.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#666666",
            }}
          >
            <p style={{ fontSize: "18px" }}>
              📭 No documents found yet. Start by uploading a file!
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: "20px",
            }}
          >
            {documents.map((doc) => (
              <motion.div
                key={doc._id}
                whileHover={{ scale: 1.02 }}
                style={{
                  background: "#2a2a2a",
                  padding: "24px",
                  borderRadius: "14px",
                  border: "1px solid #444444",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  transition: "all 0.3s ease",
                }}
              >
                <h3
                  style={{
                    marginBottom: "12px",
                    color: "#ffffff",
                    fontSize: "16px",
                    fontWeight: "700",
                  }}
                >
                  {doc.filename}
                </h3>
                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    fontSize: "14px",
                    marginBottom: "16px",
                  }}
                >
                  <p style={{ color: "#aaaaaa", margin: 0 }}>
                    <strong>📂 Category:</strong> {doc.category || "N/A"}
                  </p>
                  <p style={{ color: "#aaaaaa", margin: 0 }}>
                    <strong>🏢 Department:</strong> {doc.department || "N/A"}
                  </p>
                  <p style={{ color: "#aaaaaa", margin: 0 }}>
                    <strong>🗓️ Deadline:</strong>{" "}
                    {doc.deadline || "Not detected"}
                  </p>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "600",
                      width: "fit-content",
                      backgroundColor:
                        doc.status === "Completed" ? "#065f46" : "#7c2d12",
                      color: doc.status === "Completed" ? "#86efac" : "#fda29b",
                    }}
                  >
                    {doc.status === "Completed" ? "✅ Completed" : "⏳ Pending"}
                  </span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewPDF(doc)}
                    style={{
                      flex: 1,
                      minWidth: "90px",
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "0.2s ease",
                    }}
                    title="View document"
                    onMouseEnter={(e) =>
                      (e.target.style.background = "#2563eb")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.background = "#3b82f6")
                    }
                  >
                    👁️ View
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewIntelligence(doc._id)}
                    style={{
                      flex: 1,
                      minWidth: "90px",
                      background: "#8b5cf6",
                      color: "white",
                      border: "none",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "0.2s ease",
                    }}
                    title="View content intelligence"
                    onMouseEnter={(e) =>
                      (e.target.style.background = "#7c3aed")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.background = "#8b5cf6")
                    }
                  >
                    🧠 Intelligence
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => removeDoc(doc._id)}
                    style={{
                      flex: 1,
                      minWidth: "90px",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "0.2s ease",
                    }}
                    title="Remove document"
                    onMouseEnter={(e) =>
                      (e.target.style.background = "#dc2626")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.background = "#ef4444")
                    }
                  >
                    🗑️ Remove
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Notification */}
      <AnimatePresence>
        {alert && <Alert {...alert} onClose={() => setAlert(null)} />}
      </AnimatePresence>

      {/* PDF Viewer Modal */}
      <AnimatePresence>
        {viewPDF && (
          <PDFViewer doc={viewPDF} onClose={() => setViewPDF(null)} />
        )}
      </AnimatePresence>

      {/* Intelligence View Modal */}
      <AnimatePresence>
        {viewIntelligence && (
          <div
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
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <IntelligenceView
              docId={viewIntelligence._id}
              docName={viewIntelligence.filename}
              onClose={() => setViewIntelligence(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Documents;
