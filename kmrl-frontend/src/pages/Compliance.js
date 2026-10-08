import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import IntelligenceView from "../components/IntelligenceView";
import API_URL, { apiFetch } from "../api";

export default function Compliance() {
  const navigate = useNavigate();
  const [complianceData, setComplianceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [viewIntelligence, setViewIntelligence] = useState(null);

  useEffect(() => {
    fetchComplianceDashboard();
    const interval = setInterval(fetchComplianceDashboard, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchComplianceDashboard = async () => {
    try {
      const res = await apiFetch(`${API_URL}/compliance-dashboard`);
      if (res.ok) {
        const data = await res.json();
        setComplianceData(data);
      }
    } catch (error) {
      console.error("Compliance fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "30px", textAlign: "center" }}>
        <div style={{ fontSize: "18px", color: "#666" }}>
          📋 Loading compliance data...
        </div>
      </div>
    );
  }

  if (!complianceData) {
    return (
      <div style={{ padding: "30px", textAlign: "center" }}>
        <div style={{ fontSize: "18px", color: "#666" }}>
          No compliance data available
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "30px", maxWidth: "1400px", margin: "0 auto" }}>
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
          📜 Compliance Dashboard
        </h1>
        <p style={{ color: "#64748b", margin: "0" }}>
          Track regulatory deadlines, audit readiness, and compliance risks
        </p>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        {/* Total Compliance Terms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(102, 126, 234, 0.3)",
          }}
        >
          <div
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            {complianceData.total_with_compliance_terms}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.9 }}>
            Documents with Compliance Terms
          </div>
        </motion.div>

        {/* Regulatory Keywords */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            color: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(245, 87, 108, 0.3)",
          }}
        >
          <div
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            {complianceData.total_with_regulatory_keywords}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.9 }}>
            Regulatory References Found
          </div>
        </motion.div>

        {/* Critical Urgency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            color: "#1e293b",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(250, 112, 154, 0.3)",
          }}
        >
          <div
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            ⚠️ {complianceData.critical_urgency}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.9 }}>Critical Urgency</div>
        </motion.div>

        {/* High Urgency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
            color: "#1e293b",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(168, 237, 234, 0.3)",
          }}
        >
          <div
            style={{ fontSize: "32px", fontWeight: "700", marginBottom: "8px" }}
          >
            📌 {complianceData.high_urgency}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.9 }}>
            High Priority Items
          </div>
        </motion.div>
      </div>

      {/* Departments at Risk */}
      {Object.keys(complianceData.departments_at_risk).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: "#f8fafc",
            border: "2px solid #e2e8f0",
            borderRadius: "12px",
            padding: "25px",
            marginBottom: "30px",
          }}
        >
          <h2
            style={{
              color: "#1e293b",
              fontSize: "18px",
              fontWeight: "700",
              marginBottom: "15px",
            }}
          >
            🏢 Department Compliance Risk
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
            }}
          >
            {Object.entries(complianceData.departments_at_risk).map(
              ([dept, count]) => (
                <div
                  key={dept}
                  style={{
                    background: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    padding: "15px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "700",
                      color: "#1e293b",
                      marginBottom: "5px",
                    }}
                  >
                    {dept}
                  </div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "700",
                      color: "#e11d48",
                    }}
                  >
                    {count}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    compliance items
                  </div>
                </div>
              ),
            )}
          </div>
        </motion.div>
      )}

      {/* Compliance Tracker */}
      {complianceData.compliance_tracker &&
        complianceData.compliance_tracker.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: "white",
              border: "2px solid #e2e8f0",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "20px",
                fontSize: "18px",
                fontWeight: "700",
              }}
            >
              📊 Active Compliance Items (
              {complianceData.compliance_tracker.length})
            </div>

            <div style={{ padding: "20px" }}>
              <AnimatePresence>
                {complianceData.compliance_tracker.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() =>
                      setExpandedDoc(expandedDoc === idx ? null : idx)
                    }
                    style={{
                      background: idx % 2 === 0 ? "white" : "#f8fafc",
                      border: `2px solid ${
                        item.urgency === "Critical"
                          ? "#e11d48"
                          : item.urgency === "High"
                            ? "#f59e0b"
                            : "#cbd5e1"
                      }`,
                      borderRadius: "8px",
                      padding: "15px",
                      marginBottom: "10px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: "700",
                            color: "#1e293b",
                            marginBottom: "5px",
                            cursor: "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/documents", {
                              state: { docFilename: item.filename },
                            });
                          }}
                        >
                          {item.filename} 🔗
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              background: "#e8f4f8",
                              color: "#0369a1",
                              padding: "4px 12px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                            }}
                          >
                            📁 {item.category}
                          </span>
                          <span
                            style={{
                              background:
                                item.urgency === "Critical"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                              color:
                                item.urgency === "Critical"
                                  ? "#991b1b"
                                  : "#92400e",
                              padding: "4px 12px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                            }}
                          >
                            {item.urgency === "Critical" ? "🚨" : "⚠️"}{" "}
                            {item.urgency}
                          </span>
                          {item.regulatory && (
                            <span
                              style={{
                                background: "#f3e8ff",
                                color: "#6b21a8",
                                padding: "4px 12px",
                                borderRadius: "20px",
                                fontSize: "12px",
                                fontWeight: "600",
                              }}
                            >
                              ✓ Regulatory
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                        }}
                      >
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log("Compliance item:", item);
                            console.log("Item _id:", item._id);
                            setViewIntelligence(item._id);
                          }}
                          style={{
                            background: "#8b5cf6",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        >
                          🧠 Intelligence
                        </motion.button>
                        <div style={{ fontSize: "20px" }}>
                          {expandedDoc === idx ? "▼" : "▶"}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedDoc === idx && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          marginTop: "15px",
                          paddingTop: "15px",
                          borderTop: "1px solid #e2e8f0",
                        }}
                      >
                        {item.departments && item.departments.length > 0 && (
                          <div style={{ marginBottom: "10px" }}>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: "700",
                                color: "#64748b",
                                marginBottom: "5px",
                              }}
                            >
                              Departments Affected:
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                              }}
                            >
                              {item.departments.map((dept, i) => (
                                <span
                                  key={i}
                                  style={{
                                    background: "#e0f2fe",
                                    color: "#0c4a6e",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                  }}
                                >
                                  {dept}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
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
