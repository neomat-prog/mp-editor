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

const connectionLimit = new Map();
const connectionWindowMs = 60 * 1000;
const maxConnectionsPerIp = 15;

async function initDb() {
  try {
    await pool.query("DROP TABLE IF EXISTS documents");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        file_id VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (session_id, file_id)
      );
    `);
    const res = await pool.query(
      "SELECT content FROM documents WHERE session_id = 'default' AND file_id = 'default'"
    );
    if (res.rowCount === 0) {
      await pool.query(
        "INSERT INTO documents (session_id, file_id, file_name, content, user_id) VALUES ($1, $2, $3, $4, $5)",
        ["default", "default", "untitled.txt", "", "system"]
      );
    }
    await pool.query("CREATE INDEX IF NOT EXISTS idx_session_file ON documents (session_id, file_id)");
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

async function getDocumentContent(sessionId, fileId = "default") {
  try {
    const res = await pool.query(
      "SELECT content, file_name FROM documents WHERE session_id = $1 AND file_id = $2",
      [sessionId, fileId]
    );
    if (res.rowCount === 0) {
      const fileName = fileId === "default" ? "untitled.txt" : `untitled-${fileId}.txt`;
      await pool.query(
        "INSERT INTO documents (session_id, file_id, file_name, content, user_id) VALUES ($1, $2, $3, $4, $5)",
        [sessionId, fileId, fileName, "", "system"]
      );
      console.log(`Created new file ${fileName} (${fileId}) for session ${sessionId}`);
      return { content: "", fileName };
    }
    console.log(`Fetched content for session ${sessionId}, file ${fileId}:`, res.rows[0].content.slice(0, 50));
    return { content: res.rows[0].content, fileName: res.rows[0].file_name };
  } catch (err) {
    console.error(`Failed to get document content for session ${sessionId}, file ${fileId}:`, err);
    throw err;
  }
}

async function getFiles(sessionId) {
  try {
    const res = await pool.query(
      "SELECT DISTINCT file_id, file_name FROM documents WHERE session_id = $1 ORDER BY file_name",
      [sessionId]
    );
    const files = res.rows.map((row) => ({ fileId: row.file_id, fileName: row.file_name }));
    console.log(`Fetched files for session ${sessionId}:`, files);
    return files;
  } catch (err) {
    console.error(`Failed to get files for session ${sessionId}:`, err);
    throw err;
  }
}

async function updateDocumentContent(sessionId, fileId, fileName, newContent, userId) {
  try {
    await pool.query(
      "INSERT INTO documents (session_id, file_id, file_name, content, user_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (session_id, file_id) DO UPDATE SET content = $4, file_name = $3, user_id = $5, updated_at = CURRENT_TIMESTAMP",
      [sessionId, fileId, fileName, newContent, userId]
    );
    console.log(`Updated content for session ${sessionId}, file ${fileId} (${fileName}) by user ${userId}:`, newContent.slice(0, 50));
  } catch (err) {
    console.error(`Failed to update document for session ${sessionId}, file ${fileId}:`, err);
    throw err;
  }
}

function generateUserId() {
  return crypto.randomBytes(5).toString("hex");
}

function generateFileId() {
  return crypto.randomBytes(3).toString("hex");
}

function generateFileName(existingNames) {
  let index = existingNames.some((n) => n === "untitled.txt") ? 2 : 1;
  let name = index === 1 ? "untitled.txt" : `untitled-${index}.txt`;
  while (existingNames.includes(name)) {
    index++;
    name = `untitled-${index}.txt`;
  }
  return name;
}

const cursorPositions = new Map();
const sessions = new Map();
const userIds = new Map();
const knownUserIds = new Set();

io.on("connection", async (socket) => {
  const ip = socket.handshake.address;
  const now = Date.now();

  if (!connectionLimit.has(ip)) {
    connectionLimit.set(ip, []);
  }
  const connections = connectionLimit.get(ip).filter((time) => now - time < connectionWindowMs);
  connections.push(now);
  connectionLimit.set(ip, connections);

  if (connections.length > maxConnectionsPerIp) {
    console.log(`Rate limit exceeded for IP ${ip} on socket ${socket.id}`);
    socket.emit("error", "Too many connections");
    setTimeout(() => socket.disconnect(true), 500);
    return;
  }

  const sessionId = socket.handshake.query.sessionId || "default";
  const password = socket.handshake.query.password;
  const isPrivate = socket.handshake.query.isPrivate === "true";

  if (!/^[a-z0-9]{6}$/.test(sessionId)) {
    console.log(`Invalid sessionId ${sessionId} from socket ${socket.id}`);
    socket.emit("error", "Invalid session ID");
    setTimeout(() => socket.disconnect(true), 500);
    return;
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { isPublic: !isPrivate, password: isPrivate ? password : undefined });
  }

  const session = sessions.get(sessionId);
  if (!session.isPublic && password !== session.password) {
    console.log(`Invalid password for session ${sessionId}, socket ${socket.id}`);
    socket.emit("error", "Invalid Password");
    setTimeout(() => socket.disconnect(true), 500);
    return;
  }

  let userId = socket.handshake.query.userId;
  if (!userId || !knownUserIds.has(userId)) {
    userId = generateUserId();
    knownUserIds.add(userId);
    console.log(`Generated new userId: ${userId} for socket: ${socket.id}`);
  } else {
    console.log(`Reused client-sent userId: ${userId} for socket: ${socket.id}`);
  }
  userIds.set(socket.id, userId);

  console.log(`User connected: ${socket.id} with userId: ${userId} to session: ${sessionId}`);
  try {
    await socket.join(sessionId);
    console.log(`Socket ${socket.id} joined room ${sessionId}`);
    const { content } = await getDocumentContent(sessionId);
    socket.emit("init", content);
  } catch (err) {
    console.error(`Failed to initialize session ${sessionId} for socket ${socket.id}:`, err);
    socket.emit("error", "Failed to load session");
    setTimeout(() => socket.disconnect(true), 500);
    return;
  }

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

  socket.on("createFile", async () => {
    const fileId = generateFileId();
    const existingFiles = await getFiles(sessionId);
    const fileName = generateFileName(existingFiles.map((f) => f.fileName));
    console.log(`Creating file ${fileName} (${fileId}) for session ${sessionId} by user ${userId}`);
    try {
      await pool.query(
        "INSERT INTO documents (session_id, file_id, file_name, content, user_id) VALUES ($1, $2, $3, $4, $5)",
        [sessionId, fileId, fileName, "", userId]
      );
      io.to(sessionId).emit("fileCreated", { fileId, fileName });
    } catch (err) {
      console.error(`Failed to create file for session ${sessionId}:`, err);
      socket.emit("error", "Failed to create file");
    }
  });

  socket.on("getFiles", async () => {
    try {
      const files = await getFiles(sessionId);
      socket.emit("files", { files });
    } catch (err) {
      console.error(`Failed to fetch files for session ${sessionId}:`, err);
      socket.emit("error", "Failed to fetch files");
    }
  });

  socket.on("switchFile", async ({ fileId }) => {
    if (!fileId) {
      console.log(`Invalid fileId ${fileId} for session ${sessionId}, socket ${socket.id}`);
      socket.emit("error", "Invalid file ID");
      return;
    }
    console.log(`User ${userId} switching to file ${fileId} in session ${sessionId}`);
    try {
      const { content, fileName } = await getDocumentContent(sessionId, fileId);
      socket.emit("switchFile", { fileId, content, fileName });
    } catch (err) {
      console.error(`Failed to switch file ${fileId} for session ${sessionId}:`, err);
      socket.emit("error", "Failed to switch file");
    }
  });

  socket.on("edit", async (data) => {
    const { content, cursorOffset, fileId = "default", clientId } = data;
    const userId = userIds.get(socket.id);
    const files = await getFiles(sessionId);
    const fileName = files.find((f) => f.fileId === fileId)?.fileName || `untitled-${fileId}.txt`;
    console.log(
      `Received edit in session ${sessionId} on file ${fileName} (${fileId}) by user ${userId} (client ${clientId}):`,
      content.slice(0, 50),
      `cursor at ${cursorOffset}`
    );
    try {
      await updateDocumentContent(sessionId, fileId, fileName, content, userId);
      io.to(sessionId).emit("update", { content, cursors: Object.fromEntries(sessionCursors), fileId, userId });
    } catch (err) {
      console.error(`Failed to update edit for session ${sessionId}, file ${fileId}:`, err);
      socket.emit("error", "Failed to save edit");
    }
  });

  socket.on("cursor", (cursorOffset, fileId = "default") => {
    const userId = userIds.get(socket.id);
    console.log(
      `Cursor moved in session ${sessionId} on file ${fileId} by user ${userId} to ${cursorOffset}`
    );
    sessionCursors.set(socket.id, { offset: cursorOffset, userId });
    io.to(sessionId).emit("updateCursors", Object.fromEntries(sessionCursors), fileId);
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