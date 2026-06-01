import { execFileSync } from "child_process";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import prisma from "./lib/prisma.js";
import { seedSuperAdmin } from "./lib/seed.js";
import authRouter from "./routes/auth.js";
import clientsRouter from "./routes/clients.js";
import credentialsRouter from "./routes/credentials.js";
import dashboardRouter from "./routes/dashboard.js";
import leadsRouter from "./routes/leads.js";

if (process.env.NODE_ENV === "production") {
  try {
    execFileSync("node_modules/.bin/prisma", ["migrate", "deploy"], { stdio: "inherit" });
  } catch (err) {
    console.error("Migration falhou:", err.message);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("CORS not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "addere-ads-control", env: process.env.NODE_ENV });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "reachable" });
  } catch (err) {
    res.status(500).json({ ok: false, db: "unreachable", error: err.message });
  }
});

app.use("/auth", authRouter);
app.use("/clients/:clientId/credentials", credentialsRouter);
app.use("/clients/:clientId/leads", leadsRouter);
app.use("/clients", clientsRouter);
app.use("/dashboard", dashboardRouter);

app.listen(PORT, async () => {
  console.log(`Addere backend rodando na porta ${PORT}`);
  await seedSuperAdmin().catch((err) => console.error("Seed error:", err.message));
});
