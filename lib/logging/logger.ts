// Server-side only — do not import from client components or Edge middleware.
// For React components use lib/hooks/useLogger.ts; for middleware use requestLogger.ts.
import winston from "winston";

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const IS_PROD = process.env.NODE_ENV === "production";

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const ctx = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `${timestamp} [${level}] ${message}${ctx}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: IS_PROD ? jsonFormat : devFormat,
  }),
];

if (IS_PROD) {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      format: jsonFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: "collaboration-app" },
  transports,
});

export interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

/** Return a child logger with bound context fields on every entry. */
export function withContext(context: LogContext) {
  return logger.child(context);
}
