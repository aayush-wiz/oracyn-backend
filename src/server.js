const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const axios = require("axios"); 

dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chats");
const chartRoutes = require("./routes/charts");
const statsRoutes = require("./routes/stats");

const app = express();
const PORT = process.env.PORT;

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// API Routes
app.get("/api", (req, res) => {
  res.json({ message: "Welcome to the ORACYN RAG API!" });
});

// Health check for AI service
app.get("/api/health/ai-service", async (req, res) => {
  try {
    const response = await axios.get(`${process.env.AI_SERVICE_URL}`);
    res
      .status(200)
      .json({ status: "AI service is running", details: response.data });
  } catch (error) {
    res
      .status(503)
      .json({ status: "AI service unavailable", error: error.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/charts", chartRoutes);
app.use("/api/stats", statsRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something broke!", error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
