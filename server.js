/**
 * Hostinger / reverse-proxy: thường inject PORT (khác 3000). Nginx forward tới đúng PORT đó.
 * Nếu hPanel có "Application startup file", đặt: server.js
 * Hoặc giữ "npm run start" — script start đã gọi file này.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
process.chdir(root);

const raw = process.env.PORT ?? process.env.NODE_PORT ?? "3000";
const portNum = parseInt(String(raw), 10);
const port = String(Number.isFinite(portNum) && portNum > 0 ? portNum : 3000);
process.env.PORT = port;

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const buildId = path.join(root, ".next", "BUILD_ID");

if (!fs.existsSync(nextBin)) {
  console.error("[start] Thiếu node_modules/next — chạy npm install trên server.");
  process.exit(1);
}
if (!fs.existsSync(buildId)) {
  console.error("[start] Thiếu .next — chạy npm run build trên server trước khi start.");
  process.exit(1);
}

// stderr: nhiều panel chỉ gom log lỗi — dễ thấy khi debug 503
console.error(`[start] ktsmile cwd=${root} PORT=${port} NODE_ENV=${process.env.NODE_ENV || "production"}`);

const child = spawn(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", port], {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, PORT: port },
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code === null || code === undefined ? 1 : code);
});
