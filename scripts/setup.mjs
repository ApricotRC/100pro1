import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const nodeMajorVersion = Number.parseInt(process.versions.node.split(".")[0], 10);

if (nodeMajorVersion < 18) {
  throw new Error(`Node.js 18以上が必要です（現在: ${process.version}）。`);
}

function runNpm(args) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const commandArgs = isWindows ? ["/d", "/s", "/c", "npm", ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd: rootDirectory,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`npmを実行できませんでした: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`npmが終了コード ${result.status} で失敗しました。`);
  }
}

console.log("npm依存関係をインストールしています...");
runNpm(["install"]);

console.log("C画像処理をWebAssemblyへコンパイルしています...");
runNpm(["run", "build:wasm"]);

console.log("セットアップが完了しました。");
console.log("開発サーバー: npm run dev");
console.log("本番ビルド:   npm run build");
