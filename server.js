
import express from "express";
import dotenv from "dotenv";
import { StreamableHTTPServerTransport } from
  "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { pool, initializeDatabase } from "./db.js";
import { createMcpServer } from "./mcp.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON requests
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/", (req, res) => {
  res.send(`
    <h1>RenewalRadar is running!</h1>
    <p>Your subscription management server is online.</p>
    <p>MCP endpoint: /mcp</p>
  `);
});

// Database health check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      database: "connected"
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected"
    });
  }
});

// MCP endpoint for Claude
app.all("/mcp", async (req, res) => {
  const server = createMcpServer(pool);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal MCP server error"
      });
    }
  } finally {
    if (res.writableEnded || res.destroyed) {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    } else {
      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
    }
  }
});

// Start application
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`RenewalRadar running on port ${PORT}`);
      console.log(`MCP endpoint available at /mcp`);
    });
  } catch (error) {
    console.error("Failed to start RenewalRadar:", error);
    process.exit(1);
  }
}

startServer();
