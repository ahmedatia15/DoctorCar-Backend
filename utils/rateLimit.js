// PATH: backend/utils/rateLimit.js
// ============================================================
// Lightweight in-memory rate limiter (no external dependency).
// Good enough to throttle abusive registration/login attempts
// on a single-instance deployment.
// ============================================================

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message } = {}) {
  const hits = new Map(); // key -> number[] (timestamps)

  return (req, res, next) => {
    try {
      const key =
        req.ip ||
        (req.headers && req.headers["x-forwarded-for"]) ||
        req.socket?.remoteAddress ||
        "unknown";

      const now = Date.now();
      const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);

      // Occasional cleanup so the map does not grow forever.
      if (hits.size > 5000) {
        for (const [k, arr] of hits.entries()) {
          const live = arr.filter((t) => now - t < windowMs);
          if (live.length === 0) hits.delete(k);
          else hits.set(k, live);
        }
      }

      if (recent.length > max) {
        return res.status(429).json({
          success: false,
          message: message || "Too many attempts. Please try again later.",
          errors: [
            {
              field: "general",
              message: message || "Too many attempts. Please try again later.",
            },
          ],
        });
      }

      next();
    } catch {
      // Never let the limiter break the request pipeline.
      next();
    }
  };
}
