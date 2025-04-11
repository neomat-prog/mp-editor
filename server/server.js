const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const dotenv = require("dotenv");

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
        session_id VARCHAR(255) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const res = await pool.query(
      "SELECT content FROM documents WHERE session_id = 'default'"
    );
    if (res.rowCount === 0) {
      await pool.query(
        "INSERT INTO documents (session_id, content) VALUES ('default', '')"
      );
    }
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

async function getDocumentContent(sessionId) {
  const res = await pool.query(
    "SELECT content FROM documents WHERE session_id = $1",
    [sessionId]
  );
  if (res.rowCount === 0) {
    await pool.query(
      "INSERT INTO documents (session_id, content) VALUES ($1, '')",
      [sessionId]
    );
    return "";
  }
  return res.rows[0].content;
}

async function updateDocumentContent(sessionId, newContent) {
  await pool.query(
    "INSERT INTO documents (session_id, content) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET content = $2, updated_at = CURRENT_TIMESTAMP",
    [sessionId, newContent]
  );
}


const cursorPositions = new Map(); 
const sessions = new Map();

io.on("connection", async (socket) => {
  const sessionId = socket.handshake.query.sessionId || "default";
  const password  = socket.handshake.query.password;
  const isPrivate = socket.handshake.query.isPrivate === "true";

  if(!sessions.has(sessionId)) {
    sessions.set(sessionId, { isPublic: !isPrivate, password: isPrivate ? password : undefined});
  } else {
    const session = sessions.get(sessionId);
    if(!session.isPublic && session.password !== password) {
      socket.emit("error", "Invalid Password");
      socket.disconnect();
      return;
    }
  }


  console.log(`User connected: ${socket.id} to session: ${sessionId}`);
  const documentContent = await getDocumentContent(sessionId);
  socket.join(sessionId);
  socket.emit("init", documentContent);
  


  if (!cursorPositions.has(sessionId)) {
    cursorPositions.set(sessionId, new Map());
  }
  const sessionCursors = cursorPositions.get(sessionId);
  sessionCursors.set(socket.id, { offset: 0 });

  const userCount = io.sockets.adapter.rooms.get(sessionId)?.size || 1;
  console.log(`Users in ${sessionId}: ${userCount}`);
  io.to(sessionId).emit("userCount", userCount);

  socket.on("edit", async (data) => {
    const { content, cursorOffset } = data;
    console.log(
      `Received edit in session ${sessionId}:`,
      content,
      `cursor at ${cursorOffset}`
    );
    await updateDocumentContent(sessionId, content);
    sessionCursors.set(socket.id, { offset: cursorOffset });
    socket
      .to(sessionId)
      .emit("update", { content, cursors: Object.fromEntries(sessionCursors) });
  });

  socket.on("cursor", (cursorOffset) => {
    console.log(
      `Cursor moved in session ${sessionId} by ${socket.id} to ${cursorOffset}`
    );
    sessionCursors.set(socket.id, { offset: cursorOffset });
    socket
      .to(sessionId)
      .emit("updateCursors", Object.fromEntries(sessionCursors));
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id} from session: ${sessionId}`);
    sessionCursors.delete(socket.id);
    socket
      .to(sessionId)
      .emit("updateCursors", Object.fromEntries(sessionCursors));

    const userCount = io.sockets.adapter.rooms.get(sessionId)?.size || 0;
    console.log(`Users in ${sessionId} after disconnect: ${userCount}`);
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
