import express, { json } from "express";
import { config } from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

config();

const app = express();
app.use(json());
app.use(cors({ origin: "*" }));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chats", chatRoutes); // Changed from /api/chat
app.use("/api", uploadRoutes); // Adjusted to mount /api/chats/:id/upload correctly

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));