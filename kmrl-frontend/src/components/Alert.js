import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Alert({ message, type, onClose }) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: {
      bg: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
      border: "#10b981",
      text: "#ffffff",
      icon: "✅",
    },
    error: {
      bg: "linear-gradient(135deg, #7c2d12 0%, #92400e 100%)",
      border: "#f87171",
      text: "#ffffff",
      icon: "❌",
    },
    warning: {
      bg: "linear-gradient(135deg, #92400e 0%, #b45309 100%)",
      border: "#f59e0b",
      text: "#ffffff",
      icon: "⚠️",
    },
    info: {
      bg: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)",
      border: "#0ea5e9",
      text: "#ffffff",
      icon: "ℹ️",
    },
  };

  const alertStyle = colors[type] || colors.success;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -30, x: 50, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
        exit={{ opacity: 0, y: -30, x: 50, scale: 0.8 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: alertStyle.bg,
          border: `2px solid ${alertStyle.border}`,
          color: alertStyle.text,
          padding: "16px 20px",
          borderRadius: "12px",
          maxWidth: "400px",
          zIndex: 9999,
          boxShadow: `0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 ${alertStyle.border}20`,
          fontSize: "14px",
          fontWeight: "600",
          wordWrap: "break-word",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "2px" }}>
          {alertStyle.icon}
        </span>
        <div style={{ flex: 1 }}>{message}</div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: alertStyle.text,
            fontSize: "20px",
            cursor: "pointer",
            padding: "0",
            flexShrink: 0,
            opacity: 0.8,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.opacity = "1")}
          onMouseLeave={(e) => (e.target.style.opacity = "0.8")}
        >
          ✕
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
