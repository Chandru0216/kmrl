// reportWebVitals.js

const reportWebVitals = async (onPerfEntry) => {
  if (typeof onPerfEntry !== "function") return;

  try {
    const {
      getCLS,
      getFID,
      getFCP,
      getLCP,
      getTTFB,
    } = await import("web-vitals");

    getCLS(onPerfEntry);
    getFID(onPerfEntry);
    getFCP(onPerfEntry);
    getLCP(onPerfEntry);
    getTTFB(onPerfEntry);

  } catch (error) {
    console.error("Failed to load web-vitals:", error);
  }
};

export default reportWebVitals;
