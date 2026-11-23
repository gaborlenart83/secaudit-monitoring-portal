require("dotenv").config();

const cors = require("cors");
const express = require("express");
const authRoutes = require("./routes/authRoutes");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Backend listening on port ${port}`);
  });
}

module.exports = app;
