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
    // Drop the old table (optional, removes existing data)
    await pool.query("DROP TABLE IF EXISTS documents");

    // Create the new table with session_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed with a default session if it doesn’t exist
    const res = await pool.query("SELECT content FROM documents WHERE session_id = 'default'");
    if (res.rowCount === 0) {
      await pool.query("INSERT INTO documents (session_id, content) VALUES ('default', '')");
    }
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

async function getDocumentContent(sessionId) {
  const res = await pool.query("SELECT content FROM documents WHERE session_id = $1", [sessionId]);
  if (res.rowCount === 0) {
    await pool.query("INSERT INTO documents (session_id, content) VALUES ($1, '')", [sessionId]);
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

io.on("connection", async (socket) => {
  const sessionId = socket.handshake.query.sessionId || "default";
  console.log(`User connected: ${socket.id} to session: ${sessionId}`);

  const documentContent = await getDocumentContent(sessionId);
  socket.join(sessionId);
  socket.emit("init", documentContent);

  socket.on("edit", async (newContent) => {
    console.log(`Received edit in session ${sessionId}:`, newContent);
    await updateDocumentContent(sessionId, newContent);
    socket.to(sessionId).emit("update", newContent);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id} from session: ${sessionId}`);
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