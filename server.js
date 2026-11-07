const express = require("express");
const { Pool } = require("pg");
const app = express();

app.use(express.static("public"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// A pool keeps a few connections to the database open and reuses them
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's external address requires SSL; the internal one does not
  ssl: process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false,
});

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversions (
      id SERIAL PRIMARY KEY,
      from_unit TEXT NOT NULL,
      to_unit TEXT NOT NULL,
      input_value DOUBLE PRECISION NOT NULL,
      result DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

const lengthInMeters = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144 };

app.get("/api/convert", async (req, res) => {
  const { from, to, value } = req.query;
  const number = Number(value);

  if (
    !Object.hasOwn(lengthInMeters, from) ||
    !Object.hasOwn(lengthInMeters, to) ||
    Number.isNaN(number)
  ) {
    return res
      .status(400)
      .json({ error: "Use units m, km, mi, ft, yd and a numeric value." });
  }

  const result = (number * lengthInMeters[from]) / lengthInMeters[to];

  try {
    await pool.query(
      "INSERT INTO conversions (from_unit, to_unit, input_value, result) VALUES ($1, $2, $3, $4)",
      [from, to, number, result],
    );
    res.json({ from, to, value: number, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save the conversion." });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM conversions ORDER BY id DESC LIMIT 10",
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load history." });
  }
});

app.delete("/api/history", async (req, res) => {
  try {
    await pool.query("DELETE FROM conversions");
    res.json({ message: "History cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not clear history." });
  }
});

const PORT = process.env.PORT || 3000;

setupDatabase()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("Database setup failed:", err);
    process.exit(1);
  });
