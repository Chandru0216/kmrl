import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail } from "lucide-react";
import PDFViewer from "../components/PDFViewer";
import Alert from "../components/Alert";
import API, { apiFetch } from "../api";

const departments = [
  "All Departments",
  "Safety & Compliance",
  "Operations",
  "Finance",
  "Human Resources",
  "Legal",
  "Infrastructure",
  "Administration",
];

export default function Dashboard({ user }) {
  const [allDocs, setAllDocs] = useState([]);
  const [stats, setStats] = useState({
    total_docs: 0,
    pending: 0,
    completed: 0,
    safety_alerts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [viewPDF, setViewPDF] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [statFilter, setStatFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [alert, setAlert] = useState(null);
  const [deadlineFilter, setDeadlineFilter] = useState("All");

  // Load data from API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, docsRes] = await Promise.all([
        apiFetch(`${API}/stats`, {
          mode: "cors",
          headers: { "Content-Type": "application/json" },
        }),
        apiFetch(`${API}/documents`, {
          mode: "cors",
          headers: { "Content-Type": "application/json" },
        }),
      ]);

      if (!statsRes.ok || !docsRes.ok) throw new Error("API Error");

      const statsData = await statsRes.json();
      const docsData = await docsRes.json();

      const uniqueDocs = Array.from(
        new Map((docsData || []).map((doc) => [doc._id, doc])).values(),
      );

      setStats(
        statsData || {
          total_docs: 0,
          pending: 0,
          completed: 0,
          safety_alerts: 0,
        },
      );
      setAllDocs(uniqueDocs);
    } catch (error) {
      console.error("Load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle file upload
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setAlert({ message: "Please select a file", type: "warning" });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("department", user?.department || "Administration");

    try {
      const res = await apiFetch(`${API}/upload`, {
        method: "POST",
        mode: "cors",
        body: formData,
      });

      if (res.ok) {
        setAlert({
          message: "✅ Document uploaded and analyzed successfully!",
          type: "success",
        });
        setUploadFile(null);
        await loadData();
      } else {
        const error = await res.json();
        setAlert({ message: `Upload failed: ${error.error}`, type: "error" });
      }
    } catch (error) {
      setAlert({ message: `Error: ${error.message}`, type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleEmailSync = async () => {
    setSyncingEmail(true);
    try {
      const response = await apiFetch(`${API}/sync-source/email`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Email sync failed");

      setAlert({
        message: `Email sync complete: ${result.synced} imported, ${result.skipped} already imported, ${result.failed} failed.`,
        type: result.failed ? "warning" : "success",
      });
      if (result.synced) await loadData();
    } catch (error) {
      setAlert({ message: error.message, type: "error" });
    } finally {
      setSyncingEmail(false);
    }
  };

  // Search functionality
  const searchDocs = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      return;
    }

    try {
      const res = await apiFetch(
        `${API}/search?q=${encodeURIComponent(query)}`,
        {
          mode: "cors",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (res.ok) {
        const results = await res.json();
        setAllDocs(results);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update document status
  const updateStatus = async (id) => {
    try {
      const res = await apiFetch(`${API}/update-status/${id}`, {
        method: "PUT",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setAlert({
          message: "✅ Document marked as completed!",
          type: "success",
        });
        await loadData();
      } else {
        setAlert({ message: "Failed to update status", type: "error" });
      }
    } catch (error) {
      setAlert({ message: `Error: ${error.message}`, type: "error" });
    }
  };

  // Filter documents
  const getUpcomingDeadlines = (docs) => {
    return docs.filter((doc) => {
      if (!doc.deadline) return false;
      try {
        const deadline = new Date(doc.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return deadline >= today;
      } catch {
        return false;
      }
    });
  };

  const filteredDocs = allDocs.filter((doc) => {
    const deptMatch =
      selectedDept === "All Departments" || doc.department === selectedDept;
    const statusMatch = statusFilter === "All" || doc.status === statusFilter;
    const statMatch =
      !statFilter ||
      (() => {
        if (statFilter === "total") return true;
        if (statFilter === "pending") return doc.status === "Pending";
        if (statFilter === "completed") return doc.status === "Completed";
        if (statFilter === "safety") return doc.category === "Safety Circular";
        return true;
      })();

    const deadlineMatch =
      deadlineFilter === "All" ||
      (() => {
        if (deadlineFilter === "upcoming")
          return getUpcomingDeadlines([doc]).length > 0;
        if (deadlineFilter === "no-deadline") return !doc.deadline;
        return true;
      })();

    const searchMatch =
      !searchQuery.trim() ||
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.department?.toLowerCase().includes(searchQuery.toLowerCase());

    return (
      deptMatch && statusMatch && statMatch && deadlineMatch && searchMatch
    );
  });

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
            📊 Document Intelligence Dashboard
          </h1>
          <p style={{ color: "#cccccc", margin: 0, fontSize: "14px" }}>
            Welcome, <strong>{user?.username}</strong> | {user?.department}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: "40px", maxWidth: "1600px", margin: "0 auto" }}>
        {/* Top Section: Alerts Card (Right) + Upload (Left) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "20px",
            marginBottom: "30px",
          }}
        >
          {/* Upload Section */}
          <div
            style={{
              background: "#1f1f1f",
              padding: "25px",
              borderRadius: "14px",
              border: "1px solid #333333",
            }}
          >
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#ffffff",
                fontSize: "18px",
                fontWeight: "700",
              }}
            >
              📤 Upload Documents
            </h3>
            <form
              onSubmit={handleFileUpload}
              style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    color: "#aaaaaa",
                    fontSize: "12px",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Select file (PDF, TXT, PNG, JPG)
                </label>
                <input
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #444444",
                    borderRadius: "8px",
                    background: "#2a2a2a",
                    color: "#aaaaaa",
                    fontSize: "13px",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                style={{
                  background: uploading ? "#666666" : "#3b82f6",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                {uploading ? "⏳ Uploading..." : "↗️ Upload"}
              </button>
            </form>
            <button
              type="button"
              onClick={handleEmailSync}
              disabled={syncingEmail || uploading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "14px",
                background: "#2a2a2a",
                color: "#ffffff",
                border: "1px solid #555555",
                padding: "10px 14px",
                borderRadius: "8px",
                fontWeight: "600",
                cursor: syncingEmail || uploading ? "not-allowed" : "pointer",
                opacity: syncingEmail || uploading ? 0.7 : 1,
              }}
            >
              <Mail size={16} aria-hidden="true" />
              {syncingEmail ? "Syncing email..." : "Sync email"}
            </button>
          </div>

          {/* Deadline Alert Card - Right Side */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={() =>
              setDeadlineFilter(
                deadlineFilter === "upcoming" ? "All" : "upcoming",
              )
            }
            style={{
              background: deadlineFilter === "upcoming" ? "#ef4444" : "#1f1f1f",
              padding: "25px",
              borderRadius: "14px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
              border: `2px solid #ef4444`,
              cursor: "pointer",
              transition: "0.2s ease",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: "140px",
            }}
          >
            <div>
              <p
                style={{
                  color: deadlineFilter === "upcoming" ? "white" : "#999999",
                  margin: "0 0 10px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                📅 Upcoming Deadlines
              </p>
              <h2
                style={{
                  color: deadlineFilter === "upcoming" ? "white" : "#ef4444",
                  margin: 0,
                  fontSize: "42px",
                  fontWeight: "700",
                }}
              >
                {getUpcomingDeadlines(allDocs).length}
              </h2>
            </div>
            <p
              style={{
                margin: "10px 0 0 0",
                color:
                  deadlineFilter === "upcoming"
                    ? "rgba(255,255,255,0.8)"
                    : "#999999",
                fontSize: "12px",
              }}
            >
              Click to filter
            </p>
          </motion.div>
        </div>

        {/* Search Section */}
        <div
          style={{
            background: "#1f1f1f",
            padding: "15px 20px",
            borderRadius: "14px",
            marginBottom: "30px",
            border: "1px solid #333333",
          }}
        >
          <input
            type="text"
            placeholder="🔍 Search documents by name, category, department..."
            value={searchQuery}
            onChange={(e) => searchDocs(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid #444444",
              borderRadius: "8px",
              background: "#2a2a2a",
              color: "#ffffff",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Stats Grid - Only 3 items now (Total, Pending, Completed) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          {[
            {
              title: "Total Docs",
              value: stats.total_docs,
              icon: "📁",
              color: "#3b82f6",
              key: "total",
            },
            {
              title: "Pending",
              value: stats.pending,
              icon: "⏳",
              color: "#f59e0b",
              key: "pending",
            },
            {
              title: "Completed",
              value: stats.completed,
              icon: "✅",
              color: "#10b981",
              key: "completed",
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05, y: -5 }}
              onClick={() =>
                setStatFilter(statFilter === stat.key ? null : stat.key)
              }
              style={{
                background: statFilter === stat.key ? stat.color : "#1f1f1f",
                padding: "25px",
                borderRadius: "14px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                border: `2px solid ${stat.color}`,
                cursor: "pointer",
                transition: "0.2s ease",
              }}
            >
              <p
                style={{
                  color: statFilter === stat.key ? "white" : "#999999",
                  margin: "0 0 10px 0",
                  fontSize: "14px",
                }}
              >
                {stat.icon} {stat.title}
              </p>
              <h2
                style={{
                  color: statFilter === stat.key ? "white" : stat.color,
                  margin: 0,
                  fontSize: "32px",
                  fontWeight: "700",
                }}
              >
                {stat.value}
              </h2>
            </motion.div>
          ))}
        </div>

        {/* Department Filter */}
        <div
          style={{
            background: "#1f1f1f",
            padding: "25px",
            borderRadius: "14px",
            marginBottom: "30px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            border: "1px solid #333333",
          }}
        >
          <h3
            style={{
              margin: "0 0 15px 0",
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: "700",
            }}
          >
            🏢 Filter by Department
          </h3>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {departments.map((dept) => (
              <motion.button
                key={dept}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDept(dept)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "0.2s ease",
                  background: selectedDept === dept ? "#3b82f6" : "#333333",
                  color: selectedDept === dept ? "white" : "#cccccc",
                }}
              >
                {dept}
              </motion.button>
            ))}
          </div>

          {/* Status Filter */}
          <div style={{ marginTop: "20px" }}>
            <h4
              style={{
                margin: "0 0 10px 0",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              📌 Filter by Status
            </h4>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {["All", "Pending", "Completed"].map((status) => (
                <motion.button
                  key={status}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "13px",
                    background: statusFilter === status ? "#3b82f6" : "#333333",
                    color: statusFilter === status ? "white" : "#cccccc",
                  }}
                >
                  {status}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Deadline Filter */}
          <div style={{ marginTop: "20px" }}>
            <h4
              style={{
                margin: "0 0 10px 0",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              📅 Filter by Deadline
            </h4>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {[
                { label: "All", value: "All" },
                { label: "Upcoming Deadlines", value: "upcoming" },
                { label: "No Deadline", value: "no-deadline" },
              ].map((option) => (
                <motion.button
                  key={option.value}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setDeadlineFilter(option.value)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "13px",
                    background:
                      deadlineFilter === option.value ? "#ef4444" : "#333333",
                    color:
                      deadlineFilter === option.value ? "white" : "#cccccc",
                  }}
                >
                  {option.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        <div
          style={{
            background: "#1f1f1f",
            padding: "25px",
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            border: "1px solid #333333",
          }}
        >
          <h3
            style={{
              margin: "0 0 20px 0",
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: "700",
            }}
          >
            📄 Recently Updated Documents (Last 6)
          </h3>

          {loading ? (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#999999" }}
            >
              ⏳ Loading documents...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#666666" }}
            >
              📭 No documents found
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <AnimatePresence>
                {filteredDocs
                  .sort((a, b) => {
                    const dateA = new Date(
                      a.uploadedAt || a.createdAt || 0,
                    ).getTime();
                    const dateB = new Date(
                      b.uploadedAt || b.createdAt || 0,
                    ).getTime();
                    return dateB - dateA;
                  })
                  .slice(0, 6)
                  .map((doc) => {
                    const updateTime = new Date(
                      doc.uploadedAt || doc.createdAt,
                    );
                    const now = new Date();
                    const diffInHours = Math.floor(
                      (now - updateTime) / (1000 * 60 * 60),
                    );
                    const diffInDays = Math.floor(diffInHours / 24);
                    let timeStr = "";
                    if (diffInHours < 1) timeStr = "Just now";
                    else if (diffInHours < 24) timeStr = `${diffInHours}h ago`;
                    else if (diffInDays < 7) timeStr = `${diffInDays}d ago`;
                    else timeStr = updateTime.toLocaleDateString();

                    return (
                      <motion.div
                        key={doc._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        whileHover={{
                          scale: 1.01,
                          boxShadow: "0 10px 25px rgba(102, 126, 234, 0.15)",
                        }}
                        style={{
                          background: "#2a2a2a",
                          padding: "20px",
                          borderRadius: "10px",
                          border: "1px solid #444444",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "20px",
                          cursor: "pointer",
                          transition: "0.2s ease",
                        }}
                      >
                        {/* Left Side - Document Info */}
                        <div
                          style={{ flex: 1, minWidth: 0 }}
                          onClick={() => setViewPDF(doc)}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: "8px",
                            }}
                          >
                            <h4
                              style={{
                                margin: 0,
                                fontSize: "15px",
                                fontWeight: "700",
                                color: "#ffffff",
                              }}
                            >
                              {doc.filename}
                            </h4>
                            <span
                              style={{
                                background:
                                  doc.status === "Completed"
                                    ? "#065f46"
                                    : "#7c2d12",
                                color:
                                  doc.status === "Completed"
                                    ? "#86efac"
                                    : "#fda29b",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "700",
                              }}
                            >
                              {doc.status === "Completed"
                                ? "✅ DONE"
                                : "⏳ PENDING"}
                            </span>
                            <span
                              style={{
                                background: "#1e40af",
                                color: "#93c5fd",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "700",
                              }}
                            >
                              🕐 {timeStr}
                            </span>
                          </div>
                          <small
                            style={{
                              color: "#aaaaaa",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            {doc.summary?.slice(0, 120)}...
                          </small>
                          <small style={{ color: "#888888" }}>
                            🏢 {doc.department} • 📅 {doc.deadline} • 🌐{" "}
                            {doc.language?.toUpperCase()}
                          </small>
                        </div>

                        {/* Right Side - Actions */}
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexShrink: 0,
                          }}
                        >
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setViewPDF(doc)}
                            style={{
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "0.2s ease",
                            }}
                            title="View PDF"
                          >
                            👁️ View
                          </motion.button>

                          {doc.status === "Pending" && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => updateStatus(doc._id)}
                              style={{
                                background: "#10b981",
                                color: "white",
                                border: "none",
                                padding: "8px 14px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "0.2s ease",
                              }}
                              title="Mark as completed"
                            >
                              ✓ Complete
                            </motion.button>
                          )}

                          <span
                            style={{
                              color: "#777777",
                              fontSize: "12px",
                              padding: "8px 14px",
                              borderRadius: "6px",
                              background: "#333333",
                            }}
                          >
                            📋 Remove on Docs page
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      <AnimatePresence>
        {viewPDF && (
          <PDFViewer doc={viewPDF} onClose={() => setViewPDF(null)} />
        )}
      </AnimatePresence>

      {/* Alert Notification */}
      <AnimatePresence>
        {alert && <Alert {...alert} onClose={() => setAlert(null)} />}
      </AnimatePresence>
    </div>
  );
}
