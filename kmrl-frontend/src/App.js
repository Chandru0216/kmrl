import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Documents from "./pages/Documents";
import Compliance from "./pages/Compliance";
import AlertCenter from "./pages/AlertCenter";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Read user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("kmrl_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("kmrl_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("kmrl_user");
    setSidebarOpen(false);
  };

  // Show Login if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: "#0f0f0f",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: sidebarOpen ? "240px" : "0",
            background: "#1a1a1a",
            color: "white",
            padding: sidebarOpen ? "25px 18px" : "0",
            boxShadow: sidebarOpen ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            overflowY: "auto",
            transition: "width 0.3s ease, padding 0.3s ease",
            zIndex: 999,
            overflow: "hidden",
            borderRight: "1px solid #333333",
          }}
        >
          <h2
            style={{
              marginBottom: "30px",
              fontSize: "20px",
              fontWeight: "700",
              whiteSpace: "nowrap",
            }}
          >
            🚆 KMRL
          </h2>
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              flex: 1,
            }}
          >
            <Link
              to="/"
              style={{
                color: "#aaaaaa",
                textDecoration: "none",
                padding: "12px 14px",
                borderRadius: "8px",
                transition: "0.2s ease",
                display: "block",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#333333")}
              onMouseLeave={(e) => (e.target.style.background = "transparent")}
            >
              📈 Dashboard
            </Link>
            <Link
              to="/upload"
              style={{
                color: "#aaaaaa",
                textDecoration: "none",
                padding: "12px 14px",
                borderRadius: "8px",
                transition: "0.2s ease",
                display: "none",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#333333")}
              onMouseLeave={(e) => (e.target.style.background = "transparent")}
            >
              📤 Upload
            </Link>
            <Link
              to="/documents"
              style={{
                color: "#aaaaaa",
                textDecoration: "none",
                padding: "12px 14px",
                borderRadius: "8px",
                transition: "0.2s ease",
                display: "block",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#333333")}
              onMouseLeave={(e) => (e.target.style.background = "transparent")}
            >
              📁 Documents
            </Link>
            <Link
              to="/compliance"
              style={{
                color: "#aaaaaa",
                textDecoration: "none",
                padding: "12px 14px",
                borderRadius: "8px",
                transition: "0.2s ease",
                display: "block",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#333333")}
              onMouseLeave={(e) => (e.target.style.background = "transparent")}
            >
              📜 Compliance
            </Link>
            <Link
              to="/alerts"
              style={{
                color: "#aaaaaa",
                textDecoration: "none",
                padding: "12px 14px",
                borderRadius: "8px",
                transition: "0.2s ease",
                display: "block",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#333333")}
              onMouseLeave={(e) => (e.target.style.background = "transparent")}
            >
              🔔 Alerts
            </Link>
          </nav>
          <button
            onClick={handleLogout}
            style={{
              background: "#ef4444",
              color: "white",
              border: "none",
              padding: "12px 14px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              width: "100%",
              transition: "0.2s ease",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#dc2626")}
            onMouseLeave={(e) => (e.target.style.background = "#ef4444")}
          >
            🔓 Logout
          </button>
        </div>

        {/* Overlay when sidebar is open */}
        {sidebarOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.3)",
              zIndex: 998,
            }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Page Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          {/* Header with Hamburger Menu */}
          <div
            style={{
              background: "#000000",
              borderBottom: "2px solid #333333",
              color: "white",
              padding: "15px 20px",
              display: "flex",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: "24px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                transition: "0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.target.style.background = "rgba(255,255,255,0.1)")
              }
              onMouseLeave={(e) => (e.target.style.background = "none")}
            >
              ☰
            </button>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "600" }}>
              KMRL - Document Intelligence
            </h1>
            <div
              style={{ marginLeft: "auto", fontSize: "14px", color: "#cccccc" }}
            >
              � {user?.email} | 🏢 {user?.department}
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/upload" element={<Upload user={user} />} />
              <Route path="/documents" element={<Documents user={user} />} />
              <Route path="/compliance" element={<Compliance user={user} />} />
              <Route path="/alerts" element={<AlertCenter user={user} />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
