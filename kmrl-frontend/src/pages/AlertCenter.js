import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import IntelligenceView from "../components/IntelligenceView";
import API_URL, { apiFetch } from "../api";

export default function AlertCenter() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [viewIntelligence, setViewIntelligence] = useState(null);

  const alertTypes = [
    "All",
    "deadline_alert",
    "decision_needed",
    "compliance_alert",
    "financial_review",
    "safety_alert",
  ];
  const priorities = ["All", "Critical", "High", "Medium", "Normal"];

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [alerts, filterType, filterPriority]);

  const fetchAlerts = async () => {
    try {
      const res = await apiFetch(`${API_URL}/alert-center`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Alert fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = alerts;

    if (filterType !== "All") {
      filtered = filtered.filter((a) => a.alert_type === filterType);
    }

    if (filterPriority !== "All") {
      filtered = filtered.filter((a) => a.priority === filterPriority);
    }

    setFilteredAlerts(filtered);
  };

  const getAlertIcon = (type) => {
    const icons = {
      deadline_alert: "📅",
      decision_needed: "🔔",
      compliance_alert: "✓",
      financial_review: "💰",
      safety_alert: "🚨",
    };
    return icons[type] || "📢";
  };

  const getAlertColor = (priority) => {
    const colors = {
      Critical: { bg: "#fee2e2", border: "#e11d48", text: "#991b1b" },
      High: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
      Medium: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
      Normal: { bg: "#f1f5f9", border: "#cbd5e1", text: "#334155" },
    };
    return colors[priority] || colors["Normal"];
  };

  if (loading) {
    return (
      <div style={{ padding: "30px", textAlign: "center" }}>
        <div style={{ fontSize: "18px", color: "#666" }}>
          🔔 Loading alerts...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1
          style={{
            color: "#1e293b",
            fontWeight: "700",
            fontSize: "28px",
            margin: "0 0 10px 0",
          }}
        >
          🔔 Alert Center
        </h1>
        <p style={{ color: "#64748b", margin: "0" }}>
          Centralized view of all system alerts: decisions needed, compliance
          issues, safety alerts, and predictive recommendations
        </p>
      </div>

      {/* Alert Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "15px",
          marginBottom: "30px",
        }}
      >
        {priorities.slice(1).map((priority) => {
          const count = alerts.filter((a) => a.priority === priority).length;
          const colors = getAlertColor(priority);
          return (
            <motion.div
              key={priority}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: colors.bg,
                border: `2px solid ${colors.border}`,
                borderRadius: "8px",
                padding: "15px",
                textAlign: "center",
                cursor: "pointer",
              }}
              whileHover={{ scale: 1.05 }}
              onClick={() =>
                setFilterPriority(
                  filterPriority === priority ? "All" : priority,
                )
              }
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                {count}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: colors.text,
                  fontWeight: "600",
                }}
              >
                {priority}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div
        style={{
          background: "#f8fafc",
          border: "2px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "30px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          {/* Alert Type Filter */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: "700",
                color: "#1e293b",
                marginBottom: "8px",
                fontSize: "12px",
              }}
            >
              Alert Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            >
              {alertTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "All" ? "All Types" : type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label
              style={{
                display: "block",
                fontWeight: "700",
                color: "#1e293b",
                marginBottom: "8px",
                fontSize: "12px",
              }}
            >
              Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <div
          style={{
            background: "#f8fafc",
            border: "2px dashed #cbd5e1",
            borderRadius: "12px",
            padding: "40px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          ✓ No alerts matching your filters
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {filteredAlerts.map((alert, idx) => {
            const colors = getAlertColor(alert.priority);
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  borderRadius: "12px",
                  padding: "20px",
                  cursor: "pointer",
                }}
                whileHover={{ scale: 1.02 }}
              >
                <div
                  style={{ display: "flex", gap: "15px", alignItems: "start" }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      fontSize: "32px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {getAlertIcon(alert.alert_type)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "5px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "700",
                          color: colors.text,
                          textTransform: "uppercase",
                          fontSize: "12px",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {alert.alert_type.replace(/_/g, " ")}
                      </div>
                      <span
                        style={{
                          background: colors.border,
                          color: "white",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: "700",
                        }}
                      >
                        {alert.priority}
                      </span>
                    </div>

                    <div
                      style={{
                        color: colors.text,
                        marginBottom: "10px",
                        lineHeight: "1.5",
                      }}
                    >
                      {alert.message}
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: colors.text,
                        opacity: 0.8,
                      }}
                    >
                      📄 {alert.doc_filename}
                      {alert.timestamp && (
                        <>
                          <br />
                          🕐 {new Date(alert.timestamp).toLocaleDateString()}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexDirection: "column",
                    }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log("Alert object:", alert);
                        console.log("Alert _id:", alert._id);
                        console.log("Alert doc_id:", alert.doc_id);
                        setViewIntelligence(alert._id || alert.doc_id);
                      }}
                      style={{
                        background: "#8b5cf6",
                        color: "white",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontWeight: "700",
                        cursor: "pointer",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🧠 Intelligence
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        navigate("/documents", {
                          state: { docFilename: alert.doc_filename },
                        })
                      }
                      style={{
                        background: colors.border,
                        color: "white",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        fontWeight: "700",
                        cursor: "pointer",
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      View →
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Intelligence View Modal */}
      {viewIntelligence && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setViewIntelligence(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "700px",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <IntelligenceView
              docId={viewIntelligence}
              docName=""
              onClose={() => setViewIntelligence(null)}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
