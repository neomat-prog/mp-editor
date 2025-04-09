const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const dotenv = require("dotenv");

// Load environment variables from .env
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure Neon PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize the database table
async function initDb() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(query);
    const res = await pool.query("SELECT content FROM documents WHERE id = 1");
    if (res.rowCount === 0) {
      await pool.query("INSERT INTO documents (id, content) VALUES (1, '')");
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

// Fetch the latest document content
async function getDocumentContent() {
  const res = await pool.query("SELECT content FROM documents WHERE id = 1");
  return res.rows[0].content;
}

// Update document content
async function updateDocumentContent(newContent) {
  await pool.query(
    "UPDATE documents SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    [newContent]
  );
}

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);
  console.log("User connected:", socket.id, "from", socket.handshake.address);

  try {
    const documentContent = await getDocumentContent();
    socket.emit("init", documentContent);
  } catch (err) {
    console.error("Error sending initial content:", err);
  }

  socket.on("edit", async (newContent) => {
    console.log("Received edit:", newContent);
    try {
      await updateDocumentContent(newContent);
      console.log("Broadcasting update:", newContent);
      socket.broadcast.emit("update", newContent);
    } catch (err) {
      console.error("Error handling edit:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start the server and initialize the DB
httpServer.listen(3001, "0.0.0.0", async () => {
  try {
    await initDb();
    console.log("Server running on http://0.0.0.0:3001");
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
});