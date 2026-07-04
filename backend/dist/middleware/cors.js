"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
// In production, require explicit ALLOWED_ORIGINS — no fallback to open access
const isProduction = process.env.NODE_ENV === "production";
if (!isProduction) {
    // Allow localhost for development only
    allowedOrigins.push("http://localhost:3000", "http://localhost:3001");
}
// Always allow the known production domain
if (!allowedOrigins.includes("https://contentengineer.techaasvik.in")) {
    allowedOrigins.push("https://contentengineer.techaasvik.in");
}
exports.corsMiddleware = (0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (Render health checks, same-server calls, cron)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        console.warn(`[CORS] Blocked request from: ${origin}`);
        callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-worker-secret"],
});
//# sourceMappingURL=cors.js.map