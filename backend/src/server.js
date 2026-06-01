import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "addere-ads-control", env: process.env.NODE_ENV });
});

app.listen(PORT, () => {
  console.log(`Addere backend running on port ${PORT}`);
});
