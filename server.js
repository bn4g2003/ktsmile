/**
 * Tùy chọn: chỉ dùng khi hPanel bắt "Application startup file" = file .js.
 * Khuyến nghị: để lệnh chạy = `npm start` (gọi thẳng `next start`, một process).
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
  console.error("[start] Thiếu node_modules/next — chạy npm install.");
  process.exit(1);
}
if (!fs.existsSync(buildId)) {
  console.error("[start] Thiếu .next — chạy npm run build trước.");
  process.exit(1);
}

console.error(`[start] cwd=${root} PORT=${port} NODE_ENV=${process.env.NODE_ENV || "production"}`);

const child = spawn(process.execPath, [nextBin, "start", "--hostname", "0.0.0.0", "--port", port], {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, PORT: port },
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code === null || code === undefined ? 1 : code);
});
