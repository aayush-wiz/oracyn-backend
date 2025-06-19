const { PrismaClient } = require("@prisma/client");

/**
 * Database configuration and connection management
 */

// Global Prisma instance
let prisma;

/**
 * Create a new Prisma client with proper configuration
 * @returns {PrismaClient} Configured Prisma client
 */
const createPrismaClient = () => {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
    errorFormat: "pretty",
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // Add query logging in development
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEBUG_SQL === "true"
  ) {
    client.$on("query", (e) => {
      console.log("Query: " + e.query);
      console.log("Params: " + e.params);
      console.log("Duration: " + e.duration + "ms");
    });
  }

  return client;
};

/**
 * Get or create the global Prisma instance
 * @returns {PrismaClient} Prisma client instance
 */
const getPrismaClient = () => {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
};

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    console.log("✅ Database connection established successfully");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
};

/**
 * Initialize database connection and run health checks
 * @returns {Promise<void>}
 */
const initializeDatabase = async () => {
  try {
    console.log("🔌 Initializing database connection...");

    // Test connection
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error("Failed to establish database connection");
    }

    // Run database health checks
    await runHealthChecks();

    console.log("✅ Database initialization completed successfully");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
};

/**
 * Run database health checks
 * @returns {Promise<void>}
 */
const runHealthChecks = async () => {
  try {
    const client = getPrismaClient();

    // Check if tables exist
    const tableCheck = await client.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;

    const expectedTables = [
      "users",
      "chats",
      "messages",
      "documents",
      "charts",
    ];
    const existingTables = tableCheck.map((row) => row.table_name);

    const missingTables = expectedTables.filter(
      (table) => !existingTables.includes(table)
    );

    if (missingTables.length > 0) {
      console.warn("⚠️  Missing database tables:", missingTables.join(", "));
      console.warn('💡 Run "npm run db:migrate" to create missing tables');
    } else {
      console.log("✅ All expected database tables are present");
    }

    // Check database version
    const versionResult = await client.$queryRaw`SELECT version()`;
    console.log(
      "📊 Database version:",
      versionResult[0].version.split(" ")[0],
      versionResult[0].version.split(" ")[1]
    );

    // Check connection pool status
    const poolInfo = await client.$queryRaw`
      SELECT 
        state,
        COUNT(*) as connection_count
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state
    `;

    console.log("🔗 Connection pool status:", poolInfo);
  } catch (error) {
    console.warn("⚠️  Health check warning:", error.message);
  }
};

/**
 * Gracefully disconnect from database
 * @returns {Promise<void>}
 */
const disconnectDatabase = async () => {
  try {
    if (prisma) {
      await prisma.$disconnect();
      console.log("🔌 Database connection closed gracefully");
    }
  } catch (error) {
    console.error("❌ Error closing database connection:", error);
  }
};

/**
 * Database utility functions
 */
const dbUtils = {
  /**
   * Execute a raw query safely
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} Query result
   */
  rawQuery: async (query, params = []) => {
    try {
      const client = getPrismaClient();
      return await client.$queryRawUnsafe(query, ...params);
    } catch (error) {
      console.error("Raw query error:", error);
      throw error;
    }
  },

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database statistics
   */
  getStats: async () => {
    try {
      const client = getPrismaClient();

      const userCount = await client.user.count();
      const chatCount = await client.chat.count();
      const messageCount = await client.message.count();
      const documentCount = await client.document.count();
      const chartCount = await client.chart.count();

      return {
        users: userCount,
        chats: chatCount,
        messages: messageCount,
        documents: documentCount,
        charts: chartCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error getting database stats:", error);
      return null;
    }
  },

  /**
   * Check if database is ready for requests
   * @returns {Promise<boolean>} Ready status
   */
  isReady: async () => {
    try {
      const client = getPrismaClient();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
};

// Handle process termination
process.on("SIGINT", async () => {
  console.log("\n🛑 Received SIGINT, closing database connection...");
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, closing database connection...");
  await disconnectDatabase();
  process.exit(0);
});

module.exports = {
  getPrismaClient,
  createPrismaClient,
  testConnection,
  initializeDatabase,
  runHealthChecks,
  disconnectDatabase,
  dbUtils,
};
