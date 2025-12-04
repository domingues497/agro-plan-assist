import express from "express";
import path from "node:path";
import compression from "compression";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
app.use(compression());

app.use(
  "/api",
  createProxyMiddleware({
    target: "http://127.0.0.1:5000",
    changeOrigin: true,
    ws: true,
    logLevel: "silent",
  })
);

const distDir = path.join(process.cwd(), "dist");
app.use(express.static(distDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const PORT = 80;
app.listen(PORT, "0.0.0.0", () => {
  // no console logs per project rules
});

