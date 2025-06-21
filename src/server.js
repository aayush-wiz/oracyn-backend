const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

// Import routes
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chats");
const chartRoutes = require("./routes/charts");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));

// API Routes
app.get("/api", (req, res) => {
  res.json({ message: "Welcome to the ORACYN RAG API!" });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/charts", chartRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
