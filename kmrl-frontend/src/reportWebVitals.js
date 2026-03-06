// reportWebVitals.js

const reportWebVitals = async (onPerfEntry) => {
  if (typeof onPerfEntry !== "function") return;

  try {
    const {
      onCLS,
      onINP,
      onFCP,
      onLCP,
      onTTFB,
    } = await import("web-vitals");

    onCLS(onPerfEntry);
    onINP(onPerfEntry);   // Modern replacement for FID
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);

  } catch (error) {
    console.error("Failed to load web-vitals:", error);
  }
};

export default reportWebVitals;
