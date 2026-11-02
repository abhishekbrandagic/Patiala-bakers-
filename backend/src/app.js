import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { ah } from "./utils/http.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { stripeWebhook } from "./controllers/order.controller.js";
import { LOCAL_UPLOAD_DIR } from "./services/upload.service.js";
import publicRoutes from "./routes/public.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/src -> ../../frontend/dist
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // Default CSP blocks Cloudinary images, Google Fonts, Stripe etc.
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors({ origin: env.clientUrls, credentials: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // Stripe needs the raw body to verify signatures
  app.post(
    "/api/payments/stripe/webhook",
    express.raw({ type: "application/json" }),
    ah(stripeWebhook),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use("/uploads", express.static(LOCAL_UPLOAD_DIR, { maxAge: "7d" }));

  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, time: new Date().toISOString() }),
  );
  app.use("/api", publicRoutes);
  app.use("/api/admin", adminRoutes);

  // Unknown /api routes still get a JSON 404
  app.use("/api", notFoundHandler);

  // ── Serve the built React frontend ──────────────────────
  if (fs.existsSync(FRONTEND_DIST)) {
    // Hashed asset files can be cached for long; index.html must not be cached
    app.use(
      express.static(FRONTEND_DIST, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
          }
        },
      }),
    );

    // Any other route (/shop, /cart, /admin...) -> index.html, React Router takes over
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    });
  } else {
    logger.warn(
      { FRONTEND_DIST },
      'Frontend build not found; run "npm run build" in frontend',
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
