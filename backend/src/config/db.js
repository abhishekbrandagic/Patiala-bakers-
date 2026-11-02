import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

// Always use this database, even if MONGODB_URI has no database name in it
const DB_NAME = process.env.MONGODB_DB || "patiala-bakers";

let memoryServer = null;

export async function connectDB() {
  let uri = env.mongoUri;
  if (env.useMemoryDb || !uri) {
    if (env.isProd) throw new Error("MONGODB_URI must be set in production");
    // Keep the downloaded mongod binary inside backend/ no matter where the process is started from
    process.env.MONGOMS_DOWNLOAD_DIR ||= fileURLToPath(
      new URL(
        "../../node_modules/.cache/mongodb-memory-server",
        import.meta.url,
      ),
    );
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri(DB_NAME);
    logger.warn(
      "Using in-memory MongoDB — data is lost when the server stops. Set MONGODB_URI to persist.",
    );
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    dbName: DB_NAME,
  });
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
  return { inMemory: Boolean(memoryServer) };
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
