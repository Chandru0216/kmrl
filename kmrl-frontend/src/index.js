import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./App.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enable performance logs only in development
if (process.env.NODE_ENV === "development") {
  import("./reportWebVitals").then(({ default: reportWebVitals }) => {
    reportWebVitals(console.log);
  });
}
