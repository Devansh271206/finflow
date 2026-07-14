require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 FinFlow API running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
});

// Graceful shutdown & safety nets for unexpected errors
process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => process.exit(0));
});

module.exports = server;
