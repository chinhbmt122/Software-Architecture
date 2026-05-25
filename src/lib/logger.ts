import pino from "pino"

// Structured JSON logger. In production (Vercel), stdout is captured and indexed.
// Set LOG_LEVEL env var to override (trace|debug|info|warn|error).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "development" ? "debug" : "info"),
  base: { service: "novelhub", env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
})
