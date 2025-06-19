#!/usr/bin/env node

/**
 * Oracyn Backend Startup Script
 * Handles proper initialization of the backend services
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n🚀 ${step}: ${message}`, "cyan");
}

function logSuccess(message) {
  log(`✅ ${message}`, "green");
}

function logError(message) {
  log(`❌ ${message}`, "red");
}

function logWarning(message) {
  log(`⚠️  ${message}`, "yellow");
}

async function checkPrerequisites() {
  logStep("STEP 1", "Checking prerequisites");

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

  if (majorVersion < 18) {
    logError(
      `Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`
    );
    process.exit(1);
  }
  logSuccess(`Node.js version ${nodeVersion} ✓`);

  // Check if .env file exists
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    logWarning(
      ".env file not found. Please copy .env.example to .env and configure it."
    );

    // Try to copy .env.example
    const envExamplePath = path.join(process.cwd(), ".env.example");
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      logSuccess("Copied .env.example to .env");
      logWarning(
        "Please edit .env file with your configurations before continuing."
      );
      process.exit(1);
    } else {
      logError(
        ".env.example file not found. Please create .env file manually."
      );
      process.exit(1);
    }
  }
  logSuccess(".env file exists ✓");

  // Check if package.json exists
  const packagePath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packagePath)) {
    logError("package.json not found. Are you in the correct directory?");
    process.exit(1);
  }
  logSuccess("package.json found ✓");
}

async function installDependencies() {
  logStep("STEP 2", "Installing dependencies");

  try {
    // Check if node_modules exists
    const nodeModulesPath = path.join(process.cwd(), "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
      log("Installing npm dependencies...", "yellow");
      execSync("npm install", { stdio: "inherit" });
      logSuccess("Dependencies installed ✓");
    } else {
      logSuccess("Dependencies already installed ✓");
    }
  } catch (error) {
    logError("Failed to install dependencies");
    console.error(error.message);
    process.exit(1);
  }
}

async function setupDatabase() {
  logStep("STEP 3", "Setting up database");

  try {
    // Generate Prisma client
    log("Generating Prisma client...", "yellow");
    execSync("npx prisma generate", { stdio: "inherit" });
    logSuccess("Prisma client generated ✓");

    // Check if we can connect to database
    log("Testing database connection...", "yellow");
    try {
      execSync(
        "node -e \"const {testConnection} = require('./src/config/database'); testConnection();\"",
        { stdio: "pipe" }
      );
      logSuccess("Database connection successful ✓");

      // Run migrations
      log("Running database migrations...", "yellow");
      execSync("npx prisma db push", { stdio: "inherit" });
      logSuccess("Database migrations completed ✓");
    } catch (dbError) {
      logWarning(
        "Could not connect to database. Make sure PostgreSQL is running and .env is configured correctly."
      );
      logWarning("You can start the database with: npm run docker:up");
    }
  } catch (error) {
    logError("Database setup failed");
    console.error(error.message);
    process.exit(1);
  }
}

async function startServer(mode = "development") {
  logStep("STEP 4", `Starting server in ${mode} mode`);

  try {
    const command = mode === "development" ? "npm run dev" : "npm start";

    log(`Starting server with: ${command}`, "yellow");
    log("Press Ctrl+C to stop the server\n", "magenta");

    // Start the server
    const server = spawn(
      "npm",
      mode === "development" ? ["run", "dev"] : ["start"],
      {
        stdio: "inherit",
        shell: true,
      }
    );

    server.on("close", (code) => {
      if (code !== 0) {
        logError(`Server process exited with code ${code}`);
        process.exit(code);
      }
    });

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      log("\n\n🛑 Shutting down server...", "yellow");
      server.kill("SIGTERM");
      process.exit(0);
    });
  } catch (error) {
    logError("Failed to start server");
    console.error(error.message);
    process.exit(1);
  }
}

function printBanner() {
  log(
    `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  🚀 ORACYN BACKEND STARTUP                                   ||
║                                                              ║
║   Document Intelligence Platform Backend API                 ║
║   Version: 1.0.0                                             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `,
    "cyan"
  );
}

function printUsage() {
  log(
    `
Usage: node scripts/start.js [mode]

Modes:
  dev, development  - Start in development mode with nodemon
  prod, production  - Start in production mode
  init             - Only run initialization (no server start)

Examples:
  node scripts/start.js dev
  node scripts/start.js production
  node scripts/start.js init
  `,
    "yellow"
  );
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "development";

  printBanner();

  // Handle help flag
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  try {
    await checkPrerequisites();
    await installDependencies();
    await setupDatabase();

    if (mode === "init") {
      logSuccess("\n🎉 Initialization completed successfully!");
      log("You can now start the server with: npm run dev", "cyan");
      return;
    }

    const serverMode = ["prod", "production"].includes(mode)
      ? "production"
      : "development";
    await startServer(serverMode);
  } catch (error) {
    logError("\n💥 Startup failed!");
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  checkPrerequisites,
  installDependencies,
  setupDatabase,
  startServer,
};
