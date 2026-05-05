/**
 * Hostinger / reverse-proxy: inject PORT (thường khác 3000). Nginx forward tới đúng PORT đó.
 *
 * Quan trọng: chạy Next trong **cùng process** (không spawn child). Một số panel chỉ health-check
 * PID chính — nếu chỉ process con `next` listen port thì proxy vẫn trả 503.
 *
 * hPanel: "Application startup file" = server.js hoặc "npm run start".
 */
const fs = require("fs");
const path = require("path");

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
  `[start] ktsmile cwd=${root} PORT=${port} NODE_ENV=${process.env.NODE_ENV || "production"} (main process listener)`
);

const next = require("next");

const app = next({
  dev: false,
  hostname: "0.0.0.0",
  port,
  dir: root,
});

app.prepare().catch((err) => {
  console.error("[start] prepare() failed:", err);
  process.exit(1);
});
