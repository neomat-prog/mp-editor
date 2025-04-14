const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const app = express();
const httpServer = createServer(app);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: "*" }));
const io = new Server(httpServer, { cors: { origin: "*" } });

async function initDb() {
  try {
    await pool.query("DROP TABLE IF EXISTS documents");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (session_id, user_id)
      );
    `);
    const res = await pool.query("SELECT content FROM documents WHERE session_id = 'default'");
    if (res.rowCount === 0) {
      await pool.query("INSERT INTO documents (session_id, user_id, content) VALUES ('default', 'system', '')");
    }
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

async function getDocumentContent(sessionId) {
  const res = await pool.query("SELECT content FROM documents WHERE session_id = $1 ORDER BY updated_at DESC LIMIT 1", [sessionId]);
  if (res.rowCount === 0) {
    await pool.query("INSERT INTO documents (session_id, user_id, content) VALUES ($1, 'system', '')", [sessionId]);
    return "";
  }
  return res.rows[0].content;
}

async function updateDocumentContent(sessionId, userId, newContent) {
  await pool.query(
    "INSERT INTO documents (session_id, user_id, content) VALUES ($1, $2, $3) ON CONFLICT (session_id, user_id) DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP",
    [sessionId, userId, newContent]
  );
}

function generateUserId() {
  return crypto.randomBytes(5).toString("hex");
}

const cursorPositions = new Map();
const sessions = new Map();
const userIds = new Map();
const knownUserIds = new Set(); // Track valid userIds

io.on("connection", async (socket) => {
  const sessionId = socket.handshake.query.sessionId || "default";
  const password = socket.handshake.query.password;
  const isPrivate = socket.handshake.query.isPrivate === "true";

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { isPublic: !isPrivate, password: isPrivate ? password : undefined });
  }

  const session = sessions.get(sessionId);
  if (!session.isPublic && password !== session.password) {
    socket.emit("error", "Invalid Password");
    socket.emit("sessionType", { isPublic: session.isPublic });
    socket.disconnect(true);
    console.log(`Disconnected socket ${socket.id} due to invalid password for session ${sessionId}`);
    return;
  }

  let userId = socket.handshake.query.userId; // Check for client-sent userId
  if (!userId || !knownUserIds.has(userId)) {
    userId = generateUserId();
    knownUserIds.add(userId);
    console.log(`Generated new userId: ${userId} for socket: ${socket.id}`);
  } else {
    console.log(`Reused client-sent userId: ${userId} for socket: ${socket.id}`);
  }
  userIds.set(socket.id, userId);

  console.log(`User connected: ${socket.id} with userId: ${userId} to session: ${sessionId}`);
  await socket.join(sessionId);
  console.log(`Socket ${socket.id} joined room ${sessionId}`);

  const documentContent = await getDocumentContent(sessionId);
  socket.emit("init", documentContent);
  socket.emit("sessionType", { isPublic: session.isPublic });
  socket.emit("setUserId", { userId });

  if (!cursorPositions.has(sessionId)) cursorPositions.set(sessionId, new Map());
  const sessionCursors = cursorPositions.get(sessionId);
  sessionCursors.set(socket.id, { offset: 0 });

  const room = io.sockets.adapter.rooms.get(sessionId);
  const userCount = room ? room.size : 1;
  console.log(`Users in ${sessionId}: ${userCount} (sockets: ${[...(room || [])].join(", ")})`);
  io.to(sessionId).emit("userCount", userCount);

  socket.on("setUserId", ({ userId: clientUserId, isCreator }) => {
    if (knownUserIds.has(clientUserId)) {
      userIds.set(socket.id, clientUserId);
      console.log(`Accepted client userId: ${clientUserId} for socket: ${socket.id}`);
      socket.emit("setUserId", { userId: clientUserId });
    } else {
      console.log(`Rejected invalid client userId: ${clientUserId}, keeping ${userId}`);
    }
    if (isCreator && !session.creatorId) {
      session.creatorId = userIds.get(socket.id);
    }
    socket.emit("isCreator", session.creatorId === userIds.get(socket.id));
  });

  socket.on("edit", async (data) => {
    const { content, cursorOffset } = data;
    const userId = userIds.get(socket.id);
    console.log(`Received edit in session ${sessionId} by user ${userId}:`, content, `cursor at ${cursorOffset}`);
    await updateDocumentContent(sessionId, userId, content);
    sessionCursors.set(socket.id, { offset: cursorOffset });
    socket.to(sessionId).emit("update", { content, cursors: Object.fromEntries(sessionCursors) });
  });

  socket.on("cursor", (cursorOffset) => {
    const userId = userIds.get(socket.id);
    console.log(`Cursor moved in session ${sessionId} by user ${userId} to ${cursorOffset}`);
    sessionCursors.set(socket.id, { offset: cursorOffset });
    socket.to(sessionId).emit("updateCursors", Object.fromEntries(sessionCursors));
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id} (userId: ${userIds.get(socket.id)}) from session: ${sessionId}`);
    sessionCursors.delete(socket.id);
    userIds.delete(socket.id);
    socket.leave(sessionId);
    const room = io.sockets.adapter.rooms.get(sessionId);
    const userCount = room ? room.size : 0;
    console.log(`Users in ${sessionId} after disconnect: ${userCount} (sockets: ${[...(room || [])].join(", ")})`);
    io.to(sessionId).emit("userCount", userCount);
  });
});

httpServer.listen(3001, "0.0.0.0", async () => {
  try {
    await initDb();
    console.log("Server running on http://0.0.0.0:3001");
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
});