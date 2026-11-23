require("dotenv").config();

const cors = require("cors");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("../swagger.json");
const authRoutes = require("./routes/authRoutes");
const siteRoutes = require("./routes/siteRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

if (require.main === module) {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Backend listening on port ${port}`);
  });
}

module.exports = app;
