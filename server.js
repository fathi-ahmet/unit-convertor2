const express = require("express");
const Database = require("better-sqlite3");
const app = express();
app.use(express.static("public"));

const db = new Database("history.db");

db.exec(
  `CREATE TABLE IF NOT EXISTS conversions(id INTEGER PRIMARY KEY AUTOINCREMENT, from_unit TEXT NOT NULL, to_unit TEXT NOT NULL, input_value REAL NOT NULL, result REAL NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
);

const saveConversion = db.prepare(
  "INSERT INTO conversions (from_unit, to_unit, input_value, result) VALUES (?, ?, ?, ?)",
);
const getLatest = db.prepare(
  "SELECT * FROM conversions ORDER BY id DESC LIMIT 10",
);

const lengthInMeters = { m: 1, km: 1000, mi: 1609.34, ft: 0.3048, yd: 0.9144 };

app.get("/api/convert", (req, res) => {
  const { from, to, value } = req.query;
  const number = Number(value);

  if (
    !Object.hasOwn(lengthInMeters, from) ||
    !Object.hasOwn(lengthInMeters, to) ||
    Number.isNaN(number)
  ) {
    return res
      .status(400)
      .json({ error: "Use units m, km, mi, ft and a numeric value." });
  }

  const result = (number * lengthInMeters[from]) / lengthInMeters[to];
  saveConversion.run(from, to, number, result);

  res.json({ from, to, value: number, result });
});

app.get("/api/history", (req, res) => {
  res.json(getLatest.all());
});
const clearHistory = db.prepare("DELETE FROM conversions");

app.delete("/api/history", (req, res) => {
  clearHistory.run();
  res.json({ message: "History cleared" });
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
