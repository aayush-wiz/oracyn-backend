const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser"); // Add this
const dotenv = require("dotenv");

dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chats");
const chartRoutes = require("./routes/charts");
const statsRoutes = require("./routes/stats");

const app = express();
const PORT = process.env.PORT || 3000;

// Update CORS for cookies
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

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/charts", chartRoutes);
app.use("/api/stats", statsRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
