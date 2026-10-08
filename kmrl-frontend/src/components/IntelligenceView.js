import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import API_URL, { apiFetch } from "../api";

export default function IntelligenceView({ docId, docName, onClose }) {
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!docId) {
      console.log("No docId provided, skipping fetch");
      setLoading(false);
      return;
    }

    const fetchIntelligence = async () => {
      try {
        console.log(`Fetching intelligence for docId: ${docId}`);
        const url = `${API_URL}/extract-intelligence/${docId}`;
        console.log(`Fetch URL: ${url}`);
        const res = await apiFetch(url);
        const data = await res.json();
        console.log("Intelligence response status:", res.status);
        console.log("Intelligence response data:", data);

        if (res.ok && data) {
          console.log("Setting intelligence data:", data);
          setIntelligence(data);
        } else {
          console.error("Intelligence API error:", data);
          setIntelligence(null);
        }
      } catch (error) {
        console.error("Intelligence fetch failed:", error);
        setIntelligence(null);
      } finally {
        setLoading(false);
      }
    };

    fetchIntelligence();
  }, [docId]);

  if (loading) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "30px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "16px", color: "#666" }}>
          🔍 Extracting intelligence...
        </div>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "30px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            color: "#e11d48",
            fontWeight: "600",
            marginBottom: "10px",
          }}
        >
          ⚠️ Could not extract content intelligence
        </div>
        <div style={{ fontSize: "13px", color: "#666", marginBottom: "15px" }}>
          Document ID: {docId}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#667eea",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "13px",
          }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "📊 Overview", icon: "📋" },
    { id: "financial", label: "💰 Financial", icon: "💵" },
    { id: "decisions", label: "⚖️ Decisions", icon: "✓" },
    { id: "actions", label: "✓ Action Items", icon: "📝" },
    { id: "keywords", label: "🏷️ Keywords", icon: "#" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "16px", fontWeight: "700" }}>
            📊 Content Intelligence
          </div>
          <div style={{ fontSize: "12px", opacity: 0.9, marginTop: "4px" }}>
            {docName}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "700",
            fontSize: "14px",
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e2e8f0",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: "16px 12px",
              background: activeTab === tab.id ? "#f0f9ff" : "white",
              border: "none",
              borderBottom: activeTab === tab.id ? "3px solid #667eea" : "none",
              color: activeTab === tab.id ? "#667eea" : "#64748b",
              fontWeight: activeTab === tab.id ? "700" : "600",
              cursor: "pointer",
              fontSize: "13px",
              whiteSpace: "nowrap",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "30px" }}>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ marginBottom: "30px" }}>
              <h3
                style={{
                  color: "#1e293b",
                  fontWeight: "700",
                  marginBottom: "12px",
                }}
              >
                🎯 Document Snapshot
              </h3>
              <p
                style={{
                  color: "#64748b",
                  lineHeight: "1.6",
                  marginBottom: "16px",
                }}
              >
                This view extracts structured intelligence from your documents,
                making it easier to:
              </p>
              <ul
                style={{
                  color: "#64748b",
                  lineHeight: "1.8",
                  paddingLeft: "20px",
                }}
              >
                <li>Track financial commitments and amounts</li>
                <li>Identify decisions requiring acknowledgment</li>
                <li>Prioritize action items by urgency</li>
                <li>Discover important keywords and themes</li>
              </ul>
            </div>

            {/* Quick Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "15px",
              }}
            >
              <div
                style={{
                  background: "#e8f4f8",
                  border: "2px solid #0369a1",
                  borderRadius: "8px",
                  padding: "15px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#0369a1",
                  }}
                >
                  {intelligence.financial_data?.amounts?.length || 0}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#0369a1",
                    fontWeight: "600",
                  }}
                >
                  Financial Amounts
                </div>
              </div>

              <div
                style={{
                  background: "#f3e8ff",
                  border: "2px solid #7c3aed",
                  borderRadius: "8px",
                  padding: "15px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#7c3aed",
                  }}
                >
                  {intelligence.decisions_commitments?.decisions?.length || 0}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#7c3aed",
                    fontWeight: "600",
                  }}
                >
                  Decisions Found
                </div>
              </div>

              <div
                style={{
                  background: "#fee2e2",
                  border: "2px solid #e11d48",
                  borderRadius: "8px",
                  padding: "15px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    color: "#e11d48",
                  }}
                >
                  {intelligence.decisions_commitments?.risks?.length || 0}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#e11d48",
                    fontWeight: "600",
                  }}
                >
                  Risks Identified
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Financial Tab */}
        {activeTab === "financial" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3
              style={{
                color: "#1e293b",
                fontWeight: "700",
                marginBottom: "15px",
              }}
            >
              💰 Financial Data
            </h3>

            {intelligence.financial_data?.amounts?.length > 0 ? (
              <>
                <div style={{ marginBottom: "25px" }}>
                  <h4
                    style={{
                      color: "#64748b",
                      fontSize: "13px",
                      fontWeight: "700",
                      marginBottom: "10px",
                      textTransform: "uppercase",
                    }}
                  >
                    💵 Amounts
                  </h4>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {intelligence.financial_data.amounts.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #86efac",
                          borderRadius: "6px",
                          padding: "10px",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "#16a34a", fontWeight: "600" }}>
                          {item.currency}
                        </span>
                        <span style={{ color: "#16a34a", fontWeight: "700" }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  color: "#94a3b8",
                  padding: "20px",
                  textAlign: "center",
                }}
              >
                No financial data extracted
              </div>
            )}

            {intelligence.financial_data?.financial_terms?.length > 0 && (
              <div>
                <h4
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    fontWeight: "700",
                    marginBottom: "10px",
                    textTransform: "uppercase",
                  }}
                >
                  📌 Financial Terms
                </h4>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {intelligence.financial_data.financial_terms.map(
                    (term, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#fef3c7",
                          color: "#b45309",
                          padding: "6px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        {term}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Decisions Tab */}
        {activeTab === "decisions" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3
              style={{
                color: "#1e293b",
                fontWeight: "700",
                marginBottom: "15px",
              }}
            >
              ⚖️ Decisions & Commitments
            </h3>

            {intelligence.decisions_commitments?.decisions?.length > 0 && (
              <div style={{ marginBottom: "25px" }}>
                <h4
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    fontWeight: "700",
                    marginBottom: "10px",
                    textTransform: "uppercase",
                  }}
                >
                  ✅ Decisions
                </h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  {intelligence.decisions_commitments.decisions.map(
                    (decision, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#dbeafe",
                          border: "1px solid #7dd3fc",
                          borderRadius: "6px",
                          padding: "12px",
                          color: "#075985",
                          fontSize: "13px",
                          lineHeight: "1.5",
                        }}
                      >
                        {decision}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {intelligence.decisions_commitments?.commitments?.length > 0 && (
              <div style={{ marginBottom: "25px" }}>
                <h4
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    fontWeight: "700",
                    marginBottom: "10px",
                    textTransform: "uppercase",
                  }}
                >
                  🤝 Commitments
                </h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  {intelligence.decisions_commitments.commitments.map(
                    (commitment, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #86efac",
                          borderRadius: "6px",
                          padding: "12px",
                          color: "#15803d",
                          fontSize: "13px",
                          lineHeight: "1.5",
                        }}
                      >
                        {commitment}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {intelligence.decisions_commitments?.risks?.length > 0 && (
              <div>
                <h4
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    fontWeight: "700",
                    marginBottom: "10px",
                    textTransform: "uppercase",
                  }}
                >
                  ⚠️ Risks
                </h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  {intelligence.decisions_commitments.risks.map((risk, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#fee2e2",
                        border: "1px solid #fca5a5",
                        borderRadius: "6px",
                        padding: "12px",
                        color: "#991b1b",
                        fontSize: "13px",
                        lineHeight: "1.5",
                      }}
                    >
                      {risk}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!intelligence.decisions_commitments?.decisions?.length &&
              !intelligence.decisions_commitments?.commitments?.length &&
              !intelligence.decisions_commitments?.risks?.length && (
                <div
                  style={{
                    color: "#94a3b8",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  No decisions or commitments found
                </div>
              )}
          </motion.div>
        )}

        {/* Action Items Tab */}
        {activeTab === "actions" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3
              style={{
                color: "#1e293b",
                fontWeight: "700",
                marginBottom: "15px",
              }}
            >
              ✓ Action Items
            </h3>

            {intelligence.action_items?.length > 0 ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {intelligence.action_items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#f8fafc",
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "12px",
                      display: "flex",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        background: "#667eea",
                        color: "white",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "700",
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div
                      style={{
                        color: "#475569",
                        fontSize: "13px",
                        lineHeight: "1.5",
                      }}
                    >
                      {item}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  color: "#94a3b8",
                  padding: "20px",
                  textAlign: "center",
                }}
              >
                No action items identified
              </div>
            )}
          </motion.div>
        )}

        {/* Keywords Tab */}
        {activeTab === "keywords" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3
              style={{
                color: "#1e293b",
                fontWeight: "700",
                marginBottom: "15px",
              }}
            >
              🏷️ Key Terms & Topics
            </h3>

            {intelligence.keywords?.length > 0 ? (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {intelligence.keywords.map((keyword, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                    whileHover={{ scale: 1.1 }}
                  >
                    #{keyword}
                  </motion.span>
                ))}
              </div>
            ) : (
              <div
                style={{
                  color: "#94a3b8",
                  padding: "20px",
                  textAlign: "center",
                }}
              >
                No keywords extracted
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
