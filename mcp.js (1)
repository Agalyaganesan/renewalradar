
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createMcpServer(pool) {
  const server = new McpServer({
    name: "renewalradar",
    version: "1.0.0"
  });

  // 1. Create a subscription
  server.tool(
    "create_subscription",
    "Create a new subscription in RenewalRadar",
    {
      name: z.string(),
      provider: z.string().optional(),
      amount: z.number().nonnegative(),
      currency: z.string().default("USD"),
      billing_cycle: z.enum([
        "monthly",
        "quarterly",
        "yearly",
        "weekly"
      ]).default("monthly"),
      renewal_date: z.string(),
      notes: z.string().optional()
    },
    async (data) => {
      const result = await pool.query(
        `INSERT INTO subscriptions
        (name, provider, amount, currency, billing_cycle,
         renewal_date, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          data.name,
          data.provider || null,
          data.amount,
          data.currency,
          data.billing_cycle,
          data.renewal_date,
          data.notes || null
        ]
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.rows[0], null, 2)
        }]
      };
    }
  );

  // 2. View subscriptions
  server.tool(
    "list_subscriptions",
    "List all subscriptions stored in RenewalRadar",
    {
      status: z.enum(["active", "cancelled", "all"]).default("all")
    },
    async ({ status }) => {
      const result = await pool.query(
        status === "all"
          ? "SELECT * FROM subscriptions ORDER BY renewal_date ASC"
          : "SELECT * FROM subscriptions WHERE status = $1 ORDER BY renewal_date ASC",
        status === "all" ? [] : [status]
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.rows, null, 2)
        }]
      };
    }
  );

  // 3. Update a subscription
  server.tool(
    "update_subscription",
    "Update an existing subscription",
    {
      id: z.number().int().positive(),
      name: z.string().optional(),
      provider: z.string().optional(),
      amount: z.number().nonnegative().optional(),
      renewal_date: z.string().optional(),
      status: z.enum(["active", "cancelled"]).optional(),
      notes: z.string().optional()
    },
    async (data) => {
      const fields = [
        "name",
        "provider",
        "amount",
        "renewal_date",
        "status",
        "notes"
      ];

      const updates = fields.filter(
        field => data[field] !== undefined
      );

      if (updates.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No fields provided for update."
          }]
        };
      }

      const values = [data.id];

      const setClause = updates.map((field, index) => {
        values.push(data[field]);
        return `${field} = $${index + 2}`;
      });

      setClause.push("updated_at = CURRENT_TIMESTAMP");

      const result = await pool.query(
        `UPDATE subscriptions
         SET ${setClause.join(", ")}
         WHERE id = $1
         RETURNING *`,
        values
      );

      return {
        content: [{
          type: "text",
          text: result.rows.length
            ? JSON.stringify(result.rows[0], null, 2)
            : "Subscription not found."
        }]
      };
    }
  );

  // 4. Delete a subscription
  server.tool(
    "delete_subscription",
    "Delete a subscription using its ID",
    {
      id: z.number().int().positive()
    },
    async ({ id }) => {
      const result = await pool.query(
        "DELETE FROM subscriptions WHERE id = $1 RETURNING *",
        [id]
      );

      return {
        content: [{
          type: "text",
          text: result.rows.length
            ? `Subscription ${id} deleted successfully.`
            : "Subscription not found."
        }]
      };
    }
  );

  return server;
}
