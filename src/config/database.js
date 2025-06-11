// config/database.js
import { config } from "dotenv";

config();

export const databaseConfig = {
  url: process.env.DATABASE_URL,
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
  pool: {
    min: 0,
    max: 10,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
  },
};
