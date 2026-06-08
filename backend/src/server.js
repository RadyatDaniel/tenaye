import { setDefaultResultOrder, setServers } from "dns";
setDefaultResultOrder("ipv4first");
setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import "dotenv/config";
import "./config/env.js"; // validates required env vars at startup
import connectDB from "./config/db.js";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import authRoutes from "./routes/authRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import trackerRoutes from "./routes/trackerRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import streamRoutes from "./routes/streamRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import labOrderRoutes from "./routes/labOrderRoutes.js";
import nutritionRoutes from "./routes/nutritionRoutes.js";
import groupChatRoutes from "./routes/groupChatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import GroupChatRoom from "./models/GroupChatRoom.js";
import {
  shouldAIRespond,
  generateGroupAIResponse,
  generateWelcomeMessage,
} from "./services/groupChatAI.js";

// Connect MongoDB
connectDB();

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

// In development, also allow common local ports
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5174", "http://localhost:5175");
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

// Serve static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/trackers", trackerRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/call", callRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/lab-orders", labOrderRoutes);
app.use("/api/nutrition", nutritionRoutes);
app.use("/api/group-chat", groupChatRoutes);
app.use("/api/messages", messageRoutes);

app.get("/health", (_, res) => {
  const dbState = mongoose.connection.readyState;
  // 1 = connected, 2 = connecting
  if (dbState === 1) {
    return res.status(200).json({ status: "ok", db: "connected" });
  }
  return res.status(503).json({ status: "degraded", db: "disconnected" });
});

// Tracks human messages since the last AI response, per group room
const groupChatAICounts = new Map();

// Socket.IO — WebRTC signaling + AI group therapy chat
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`[Socket] ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("offer", ({ roomId, offer }) =>
    socket.to(roomId).emit("offer", { offer, from: socket.id }),
  );
  socket.on("answer", ({ roomId, answer }) =>
    socket.to(roomId).emit("answer", { answer, from: socket.id }),
  );
  socket.on("ice-candidate", ({ roomId, candidate }) =>
    socket.to(roomId).emit("ice-candidate", { candidate, from: socket.id }),
  );

  socket.on("end-call", ({ roomId }) => {
    socket.to(roomId).emit("call-ended");
    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    // Update participant count in group room when someone leaves
    const groupRoomId = socket.data.groupRoomId;
    if (groupRoomId) {
      const count = Math.max(
        (io.sockets.adapter.rooms.get(groupRoomId)?.size || 1) - 1,
        0,
      );
      io.to(groupRoomId).emit("group-chat:participants", { count });
    }
  });

  // Scheduled appointment call started by doctor
  socket.on("call-started", (data) => {
    const { patientId, doctorId, doctorName, appointmentId, timestamp } = data;
    console.log(
      `[Socket] Doctor ${doctorId} started call for appointment ${appointmentId}`,
    );

    // Notify the patient that doctor has started the call
    io.emit(`call-started-${patientId}`, {
      doctorId,
      doctorName,
      appointmentId,
      timestamp,
    });

    // Broadcast to all user's sockets
    socket.broadcast.emit(`call-started-${patientId}`, {
      doctorId,
      doctorName,
      appointmentId,
      timestamp,
    });
  });

  // Missed call notification (when patient doesn't join within time window)
  socket.on("call-missed", (data) => {
    const { patientId, doctorId, doctorName, appointmentId } = data;
    console.log(
      `[Socket] Missed call from doctor ${doctorId} to patient ${patientId}`,
    );

    io.emit(`call-missed-${patientId}`, {
      doctorId,
      doctorName,
      appointmentId,
      timestamp: new Date().toISOString(),
    });
  });

  // Chat message relay between patient and doctor in the same room
  socket.on("chat-message", (data) => {
    const { roomId, message } = data;
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    const clientCount = roomSockets ? roomSockets.size : 0;
    console.log(
      `[Socket] Chat message in room ${roomId} from ${message.senderName} | ${clientCount} clients in room`,
    );

    // Broadcast to all other clients in the room (excluding sender)
    socket.to(roomId).emit("chat-message", { message });
  });

  // ── Direct Messaging (patient ↔ doctor) ────────────────────────────────────
  socket.on("dm:send", ({ receiverId, message }) => {
    // Relay to all sockets belonging to the receiver
    io.emit(`dm:${receiverId}`, message);
  });

  // ── AI Group Therapy Chat ──────────────────────────────────────────────────

  socket.on("group-chat:join", async ({ roomId, userId, userName }) => {
    socket.join(roomId);
    socket.data.groupRoomId = roomId;
    socket.data.userName = userName;
    const count = io.sockets.adapter.rooms.get(roomId)?.size || 1;
    io.to(roomId).emit("group-chat:participants", { count });
    console.log(`[GroupChat] ${userName} joined room ${roomId} | ${count} online`);

    // AI sends a personalised welcome after a short delay
    setTimeout(async () => {
      try {
        const room = await GroupChatRoom.findById(roomId);
        if (!room) return;
        const welcomeText = await generateWelcomeMessage(room.moodGroup, userName);
        const updated = await GroupChatRoom.findByIdAndUpdate(
          roomId,
          { $push: { messages: { senderName: "AI Therapist", text: welcomeText, isAI: true, timestamp: new Date() } } },
          { new: true },
        );
        const welcomeMsg = updated.messages[updated.messages.length - 1];
        io.to(roomId).emit("group-chat:message", {
          _id: welcomeMsg._id,
          senderName: "AI Therapist",
          text: welcomeMsg.text,
          isAI: true,
          timestamp: welcomeMsg.timestamp,
        });
      } catch (err) {
        console.error("[GroupChat] Welcome error:", err.message);
      }
    }, 1500);
  });

  socket.on(
    "group-chat:message",
    async ({ roomId, text, userId, userName }) => {
      if (!roomId || !text?.trim()) return;
      try {
        const room = await GroupChatRoom.findByIdAndUpdate(
          roomId,
          {
            $push: {
              messages: {
                senderId: userId || null,
                senderName: userName,
                text: text.trim(),
                isAI: false,
                timestamp: new Date(),
              },
            },
          },
          { new: true },
        );
        if (!room) return;

        const savedMsg = room.messages[room.messages.length - 1];

        // Relay to everyone else (sender added it optimistically in UI)
        socket.to(roomId).emit("group-chat:message", {
          _id: savedMsg._id,
          senderName: savedMsg.senderName,
          text: savedMsg.text,
          isAI: false,
          timestamp: savedMsg.timestamp,
        });

        // Decide whether AI should respond
        const key = roomId.toString();
        const countSinceLast = (groupChatAICounts.get(key) || 0) + 1;
        groupChatAICounts.set(key, countSinceLast);

        if (shouldAIRespond(text.trim(), countSinceLast)) {
          groupChatAICounts.set(key, 0);
          io.to(roomId).emit("group-chat:typing");

          setTimeout(async () => {
            try {
              const aiText = await generateGroupAIResponse(
                room.moodGroup,
                room.messages.slice(-12),
                { senderName: userName, text: text.trim() },
              );

              const updated = await GroupChatRoom.findByIdAndUpdate(
                roomId,
                {
                  $push: {
                    messages: {
                      senderName: "AI Therapist",
                      text: aiText,
                      isAI: true,
                      timestamp: new Date(),
                    },
                  },
                },
                { new: true },
              );
              const aiMsg = updated.messages[updated.messages.length - 1];

              io.to(roomId).emit("group-chat:message", {
                _id: aiMsg._id,
                senderName: "AI Therapist",
                text: aiMsg.text,
                isAI: true,
                timestamp: aiMsg.timestamp,
              });
            } catch (aiErr) {
              console.error("[GroupChat] AI error:", aiErr.message);
              io.to(roomId).emit("group-chat:typing-stop");
            }
          }, 1800);
        }
      } catch (err) {
        console.error("[GroupChat] message error:", err.message);
      }
    },
  );
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`[Server] Running on port ${PORT}`));
