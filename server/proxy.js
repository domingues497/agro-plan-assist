import "dotenv/config";
import express from "express";
import path from "node:path";
import compression from "compression";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
app.use(compression());

const API_TARGET = process.env.API_TARGET || "http://127.0.0.1:5000";
app.use(
  "/api",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    ws: true,
    logLevel: "silent",
  })
);

const uploadsDir = path.join(process.cwd(), "server", "uploads");
console.log('Serving uploads from:', uploadsDir);
app.use(express.static(uploadsDir));

const distDir = path.join(process.cwd(), "dist");
app.use(express.static(distDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const PORT = Number(process.env.PORT || 80);
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  // no console logs per project rules
});
