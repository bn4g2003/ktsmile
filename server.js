/**
 * Hostinger / reverse-proxy: inject PORT (thường khác 3000).
 *
 * Next 16: `next().prepare()` không tự bind TCP — cần `http.createServer` + `getRequestHandler`.
 * Chạy trong **process chính** (không spawn child) để panel health-check / proxy nhận đúng PID listen.
 *
 * hPanel: "Application startup file" = server.js hoặc `npm run start`.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { parse } = require("url");

const root = path.resolve(__dirname);
process.chdir(root);

const raw = process.env.PORT ?? process.env.NODE_PORT ?? "3000";
const portNum = parseInt(String(raw), 10);
const port = Number.isFinite(portNum) && portNum > 0 ? portNum : 3000;
process.env.PORT = String(port);

const nextPkg = path.join(root, "node_modules", "next", "dist", "server", "next.js");
const buildId = path.join(root, ".next", "BUILD_ID");

if (!fs.existsSync(nextPkg)) {
  console.error("[start] Thiếu node_modules/next — chạy npm install trên server.");
  process.exit(1);
}
if (!fs.existsSync(buildId)) {
  console.error("[start] Thiếu .next — chạy npm run build trên server trước khi start.");
  process.exit(1);
}

console.error(
  `[start] ktsmile cwd=${root} PORT=${port} NODE_ENV=${process.env.NODE_ENV || "production"}`
);

const next = require("next");

const hostname = "0.0.0.0";
const app = next({
  dev: false,
  hostname,
  port,
  dir: root,
});

app
  .prepare()
  .then(() => {
    const handle = app.getRequestHandler();
    const server = http.createServer((req, res) => {
      handle(req, res, parse(req.url, true));
    });

    server.listen(port, hostname, () => {
      console.error(`[start] listening http://${hostname}:${port}`);
    });

    server.on("error", (err) => {
      console.error("[start] HTTP server error:", err);
      process.exit(1);
    });

    const shutdown = () => {
      server.close(() => process.exit(0));
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })
  .catch((err) => {
    console.error("[start] prepare() failed:", err);
    process.exit(1);
  });
