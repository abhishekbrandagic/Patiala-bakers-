(async () => {
  try {
    console.log("Starting backend...");

    await import("./src/server.js");

    console.log("Backend started successfully");
  } catch (error) {
    console.error("Backend startup failed:", error);
    process.exit(1);
  }
})();
