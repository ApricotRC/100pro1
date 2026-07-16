// 開発用: SNS APIサーバーと Vite 開発サーバーを同時に起動する。
// Windows でも動くよう、シェルの & に頼らず child_process で両方を管理する。

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

const children = [];

function launch(label, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code) => {
    console.log(`[dev] ${label} が終了しました (code=${code ?? "?"})`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

launch("APIサーバー", process.execPath, [join(rootDir, "server", "server.mjs")]);
// --host: 同じLANの友だちのスマホやPCからもアクセスできるようにする。
launch("Vite", process.execPath, [join(rootDir, "node_modules", "vite", "bin", "vite.js"), "--host"]);
