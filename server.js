
import express from "express";
import dotenv from "dotenv";
import { StreamableHTTPServerTransport } from
  "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { pool, initializeDatabase } from "./db.js";
import { createMcpServer } from "./mcp.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// Dashboard files
app.get("/", (req, res) => res.sendFile(process.cwd() + "/index.html"));
app.get("/style.css", (req, res) => res.sendFile(process.cwd() + "/style.css"));
app.get("/script.js", (req, res) => res.sendFile(process.cwd() + "/script.js"));

// Health check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "unhealthy" });
  }
});

// Get all subscriptions
app.get("/api/subscriptions", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM subscriptions ORDER BY renewal_date ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load subscriptions" });
  }
});

// Create subscription
app.post("/api/subscriptions", async (req, res) => {
  try {
    const {
      name, provider, amount, currency,
      billing_cycle, renewal_date, notes
    } = req.body;

    if (!name || !renewal_date || amount === undefined ||
        !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({
        error: "Name, valid amount and renewal date are required"
      });
    }

    const result = await pool.query(
      `INSERT INTO subscriptions
       (name, provider, amount, currency, billing_cycle, renewal_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        name, provider || null, amount,
        currency || "USD", billing_cycle || "monthly",
        renewal_date, notes || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to create subscription" });
  }
});

// Update subscription
app.put("/api/subscriptions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid subscription ID" });
    }

    const allowed = [
      "name", "provider", "amount", "currency",
      "billing_cycle", "renewal_date", "notes"
    ];

    const fields = allowed.filter(
      field => req.body[field] !== undefined
    );

    if (!fields.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    if (req.body.amount !== undefined &&
        (!Number.isFinite(Number(req.body.amount)) ||
         Number(req.body.amount) < 0)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const values = [id];

    const updates = fields.map((field, index) => {
      values.push(req.body[field]);
      return `${field} = $${index + 2}`;
    });

    updates.push("updated_at = CURRENT_TIMESTAMP");

    const result = await pool.query(
      `UPDATE subscriptions
       SET ${updates.join(", ")}
       WHERE id = $1 RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to update subscription" });
  }
});

// Delete subscription
app.delete("/api/subscriptions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid subscription ID" });
    }

    const result = await pool.query(
      "DELETE FROM subscriptions WHERE id = $1 RETURNING *",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.json({ message: "Subscription deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to delete subscription" });
  }
});

// Claude MCP endpoint
app.all("/mcp", async (req, res) => {
  const server = createMcpServer(pool);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: "MCP server error" });
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
    });
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
}

startServer();

