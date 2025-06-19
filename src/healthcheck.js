/**
 * Health check script for Docker container
 * This script is used by Docker to determine if the container is healthy
 */

const http = require("http");

const options = {
  host: "localhost",
  port: process.env.PORT || 5000,
  path: "/health",
  timeout: 2000,
  method: "GET",
};

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);

  if (res.statusCode === 200) {
    process.exit(0); // Success
  } else {
    process.exit(1); // Failure
  }
});

request.on("error", (err) => {
  console.error("Health check failed:", err.message);
  process.exit(1); // Failure
});

request.on("timeout", () => {
  console.error("Health check timed out");
  request.abort();
  process.exit(1); // Failure
});

request.end();
