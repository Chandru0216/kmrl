import React, { useState } from "react";
import { motion } from "framer-motion";
import API_URL from "../api";

const departments = [
  "Safety & Compliance",
  "Operations",
  "Finance",
  "Human Resources",
  "Legal",
  "Infrastructure",
  "Administration",
  "Management",
];

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullname: "",
    department: "Safety & Compliance",
    registrationCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validation
      if (!formData.email || !formData.password) {
        setError("Email and password are required");
        setLoading(false);
        return;
      }

      if (!formData.email.includes("@")) {
        setError("Please enter a valid email");
        setLoading(false);
        return;
      }

      if (isRegister) {
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (formData.password.length < 12) {
          setError("Password must be at least 12 characters");
          setLoading(false);
          return;
        }
        if (!formData.fullname.trim()) {
          setError("Full name is required");
          setLoading(false);
          return;
        }
        if (!formData.registrationCode.trim()) {
          setError("Registration code is required");
          setLoading(false);
          return;
        }
      }

      const response = await fetch(
        `${API_URL}/auth/${isRegister ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            fullname: formData.fullname,
            department: formData.department,
            registration_code: formData.registrationCode,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Authentication failed");

      sessionStorage.setItem("document_routing_token", result.token);
      sessionStorage.setItem(
        "document_routing_user",
        JSON.stringify(result.user),
      );
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          width: "100%",
          maxWidth: "450px",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            color: "#1e293b",
            marginBottom: "10px",
            fontSize: "28px",
            fontWeight: "700",
          }}
        >
          Document Routing Engine
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            marginBottom: "30px",
            fontSize: "14px",
          }}
        >
          Intelligent document intake, analysis, and routing
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* Email */}
          <div>
            <label
              style={{
                color: "#1e293b",
                fontWeight: "600",
                fontSize: "13px",
                display: "block",
                marginBottom: "6px",
              }}
            >
              📧 Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Full Name (Register only) */}
          {isRegister && (
            <div>
              <label
                style={{
                  color: "#1e293b",
                  fontWeight: "600",
                  fontSize: "13px",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                👤 Full Name
              </label>
              <input
                type="text"
                name="fullname"
                value={formData.fullname}
                onChange={handleChange}
                placeholder="John Doe"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Department */}
          <div>
            <label
              style={{
                color: "#1e293b",
                fontWeight: "600",
                fontSize: "13px",
                display: "block",
                marginBottom: "6px",
              }}
            >
              🏢 Department
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {isRegister && (
            <div>
              <label
                style={{
                  color: "#1e293b",
                  fontWeight: "600",
                  fontSize: "13px",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Registration Code
              </label>
              <input
                type="password"
                name="registrationCode"
                value={formData.registrationCode}
                onChange={handleChange}
                autoComplete="off"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label
              style={{
                color: "#1e293b",
                fontWeight: "600",
                fontSize: "13px",
                display: "block",
                marginBottom: "6px",
              }}
            >
              🔒 Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Confirm Password (Register only) */}
          {isRegister && (
            <div>
              <label
                style={{
                  color: "#1e293b",
                  fontWeight: "600",
                  fontSize: "13px",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                🔒 Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                padding: "12px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                border: "1px solid #fecaca",
              }}
            >
              ❌ {error}
            </div>
          )}

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "⏳ Processing..."
              : isRegister
                ? "📝 Register"
                : "🔓 Login"}
          </motion.button>

          {/* Toggle Login/Register */}
          <div
            style={{
              textAlign: "center",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            {isRegister
              ? "Already have an account? "
              : "Don't have an account? "}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              style={{
                background: "none",
                border: "none",
                color: "#667eea",
                fontWeight: "700",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {isRegister ? "Login" : "Register"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
