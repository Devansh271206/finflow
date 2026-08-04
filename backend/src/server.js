const env = require("./config/env");
const logger = require("./utils/logger");
const app = require("./app");

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 FinFlow API running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

// Graceful shutdown & safety nets for unexpected errors
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => process.exit(0));
});

module.exports = server;