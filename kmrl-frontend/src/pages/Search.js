import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API, { apiFetch } from "../api";

export default function Search() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchDocs = useCallback(async () => {
    if (!query.trim()) {
      setError("Please enter a search term.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await apiFetch(
        `${API}/search?q=${encodeURIComponent(query.trim())}`,
      );

      if (!res.ok) throw new Error("Server error");

      const data = await res.json();

      // ✅ Remove duplicates safely
      const uniqueDocs = Array.from(
        new Map((data || []).map((doc) => [doc._id, doc])).values(),
      );

      setSearchResults(uniqueDocs);
      setSearched(true);
    } catch (err) {
      console.error(err);
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // ✅ Optimistic update instead of re-search
  const updateStatus = async (id) => {
    try {
      await apiFetch(`${API}/update-status/${id}`, { method: "PUT" });

      setSearchResults((prev) =>
        prev.map((doc) =>
          doc._id === id ? { ...doc, status: "Completed" } : doc,
        ),
      );
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") searchDocs();
  };

  const clearSearch = () => {
    setQuery("");
    setSearchResults([]);
    setSearched(false);
    setError(null);
  };

  return (
    <div className="content-area">
      <h2 className="section-header">🔍 Search Documents</h2>

      <div className="search-section">
        <input
          type="text"
          placeholder="Search by filename, category, department, or content..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        <button onClick={searchDocs} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>

        <button onClick={clearSearch} disabled={loading}>
          Clear
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {searched && (
        <div className="documents-section">
          <h2 className="section-header">
            Search Results ({searchResults.length})
          </h2>

          <AnimatePresence>
            {searchResults.length === 0 && !loading ? (
              <motion.p
                className="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                No documents found.
              </motion.p>
            ) : (
              <div className="card-grid">
                {searchResults.map((doc) => (
                  <motion.div
                    key={doc._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DocumentCard doc={doc} updateStatus={updateStatus} />
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
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

      <p className="summary">{doc.summary || "No summary available."}</p>

      <div className="meta">
        <p>
          <b>Category:</b> {doc.category || "N/A"}
        </p>
        <p>
          <b>Department:</b> {doc.department || "N/A"}
        </p>
        <p>
          <b>Deadline:</b> {doc.deadline || "N/A"}
        </p>
      </div>

      <div
        className={`status-badge ${
          isCompleted ? "status-completed" : "status-pending"
        }`}
      >
        {isCompleted ? "✅ Completed" : "⏳ Pending"}
      </div>

      {!isCompleted && (
        <button className="mark-btn" onClick={() => updateStatus(doc._id)}>
          ✓ Mark Completed
        </button>
      )}
    </div>
  );
}
