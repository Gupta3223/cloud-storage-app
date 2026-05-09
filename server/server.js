import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import folderRoutes from "./routes/folderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();

/* MIDDLEWARE */
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

/* DATABASE */
connectDB();

/* SOCKET.IO SETUP */
const httpServer = http.createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  socket.on("join-user", (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User joined room user:${userId}`);
  });

  socket.on("join-admin", () => {
    socket.join("admins");
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

/* ROUTES */
app.use("/api/auth", authRoutes);
app.use("/api/folders", folderRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);

/* STATIC FILES */
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Cloud Storage Server Running...");
});

/* START SERVER */
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, "0.0.0.0",() => {
  console.log(`🚀 Server running on port ${PORT}`);
});
