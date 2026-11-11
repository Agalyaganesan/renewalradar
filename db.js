
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(255),
      amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      billing_cycle VARCHAR(50) DEFAULT 'monthly',
      renewal_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("RenewalRadar database initialized");
}
