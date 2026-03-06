import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API = "http://127.0.0.1:5000";

export default function Department() {
  const [allDocs, setAllDocs] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAllDocs();
  }, []);

  const loadAllDocs = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API}/documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");

      const data = await res.json();

      // ✅ Remove duplicates by _id
      const uniqueDocs = Array.from(
        new Map((data || []).map(doc => [doc._id, doc])).values()
      );

      setAllDocs(uniqueDocs);
    } catch (err) {
      console.error(err);
      setError("Could not load documents.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Unique departments
  const allDepartments = useMemo(() => {
    return [...new Set(
      allDocs
        .map(doc => doc.department?.trim())
        .filter(Boolean)
    )];
  }, [allDocs]);

  // ✅ Filter docs safely
  const departmentResults = useMemo(() => {
    if (!selectedDepartment) return [];
    return allDocs.filter(
      doc => doc.department === selectedDepartment
    );
  }, [selectedDepartment, allDocs]);

  // ✅ Optimistic UI update (no full reload)
  const updateStatus = useCallback(async (id) => {
    try {
      await fetch(`${API}/update-status/${id}`, { method: "PUT" });

      setAllDocs(prev =>
        prev.map(doc =>
          doc._id === id
            ? { ...doc, status: "Completed" }
            : doc
        )
      );
    } catch (err) {
      console.error("Status update failed:", err);
    }
  }, []);

  return (
    <div className="page-wrapper">

      <div className="content-area">
        <h2 className="section-header">🏢 Filter by Department</h2>

        {loading && <p className="empty-state">Loading documents...</p>}
        {error && <p className="error-message">{error}</p>}

        {!loading && (
          <div className="department-section">
            <div className="department-buttons">
              {allDepartments.length === 0 ? (
                <p className="empty-state">
                  No departments found. Upload documents first!
                </p>
              ) : (
                <>
                  {allDepartments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => setSelectedDepartment(dept)}
                      className={
                        selectedDepartment === dept ? "active" : ""
                      }
                    >
                      {dept}
                    </button>
                  ))}

                  {selectedDepartment && (
                    <button
                      onClick={() => setSelectedDepartment(null)}
                      className="clear-btn"
                    >
                      ✕ Clear Filter
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedDepartment && (
            <motion.div
              className="documents-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="section-header">
                🏢 {selectedDepartment} ({departmentResults.length})
              </h2>

              {departmentResults.length === 0 ? (
                <p className="empty-state">
                  No documents in this department.
                </p>
              ) : (
                <div className="card-grid">
                  {departmentResults.map((doc) => (
                    <motion.div
                      key={doc._id}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DocumentCard
                        doc={doc}
                        updateStatus={updateStatus}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!selectedDepartment && allDepartments.length > 0 && !loading && (
          <p className="empty-state" style={{ marginTop: 30 }}>
            Select a department above to view its documents.
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentCard({ doc, updateStatus }) {
  const isCompleted = doc.status === "Completed";

  return (
    <div className="document-card">
      <div className="card-header">
        <h3>{doc.filename}</h3>

        {doc.language && doc.language !== "unknown" && (
          <span className="language-badge">
            🌐 {doc.language.toUpperCase()}
          </span>
        )}
      </div>

      <p className="summary">
        {doc.summary || "No summary available."}
      </p>

      <div className="meta">
        <p><b>Category:</b> {doc.category || "N/A"}</p>
        <p><b>Department:</b> {doc.department || "N/A"}</p>
        <p><b>Deadline:</b> {doc.deadline || "N/A"}</p>
      </div>

      <div
        className={`status-badge ${
          isCompleted ? "status-completed" : "status-pending"
        }`}
      >
        {isCompleted ? "✅ Completed" : "⏳ Pending"}
      </div>

      {!isCompleted && (
        <button
          className="mark-btn"
          onClick={() => updateStatus(doc._id)}
        >
          ✓ Mark Completed
        </button>
      )}
    </div>
  );
}
