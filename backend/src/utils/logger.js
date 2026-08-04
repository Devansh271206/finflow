/**
 * Centralized Logger
 * ------------------------------------------------------------------
 * Thin wrapper around console so every module logs through one place
 * instead of calling console.* directly with scattered eslint-disable
 * comments. Behavior today is intentionally simple (still just console
 * under the hood) - swapping in a structured/production logger later
 * (e.g. pino/winston) only requires changing this file, not call sites.
 *
 * info/debug are suppressed in production to avoid noisy stdout; warn/
 * error always print since they matter regardless of environment.
 */

const env = require("../config/env");

const isProduction = env.isProduction;

/* eslint-disable no-console */
const logger = {
  info: (...args) => {
    if (!isProduction) console.log(...args);
  },
  debug: (...args) => {
    if (!isProduction) console.debug(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
};
/* eslint-enable no-console */

module.exports = logger;