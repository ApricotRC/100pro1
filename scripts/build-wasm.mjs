import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const WASI_SDK_VERSION = "24.0";
const WASI_SDK_RELEASE = "24";
const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const toolsDirectory = join(rootDirectory, ".tools");
const sourceFile = join(rootDirectory, "native", "image_processor.c");
const outputDirectory = join(rootDirectory, "public", "wasm");
const outputFile = join(outputDirectory, "image_processor.wasm");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDirectory,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`${command} を実行できませんでした: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} が終了コード ${result.status} で失敗しました。`);
  }
}

function getPlatformTarget() {
  const platformNames = {
    darwin: "macos",
    linux: "linux",
    win32: "windows",
  };
  const platform = platformNames[process.platform];

  if (!platform) {
    throw new Error(
      `未対応のOSです: ${process.platform}\nWASI_SDK_PATH にWASI SDKのパスを指定してください。`,
    );
  }

  let architecture;
  if (process.platform === "win32") {
    // WASI SDKはWindows向けにx86_64版を配布している。Windows on Armではx64エミュレーションで実行する。
    architecture = "x86_64";
  } else if (process.arch === "arm64") {
    architecture = "arm64";
  } else if (process.arch === "x64") {
    architecture = "x86_64";
  } else {
    throw new Error(
      `未対応のCPUです: ${process.arch}\nWASI_SDK_PATH にWASI SDKのパスを指定してください。`,
    );
  }

  return { platform, architecture };
}

function getCompilerPath(sdkDirectory) {
  const executable = process.platform === "win32" ? "clang.exe" : "clang";
  return join(sdkDirectory, "bin", executable);
}

async function downloadFile(url, destination) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
      return;
    } catch (error) {
      lastError = error;
      await rm(destination, { force: true });
      if (attempt < 3) {
        console.warn(`ダウンロードに失敗しました。再試行します（${attempt}/3）。`);
      }
    }
  }

  throw new Error(`WASI SDKをダウンロードできませんでした: ${lastError?.message ?? lastError}`);
}

async function findCompiler() {
  if (process.env.WASI_SDK_PATH) {
    const configuredCompiler = getCompilerPath(process.env.WASI_SDK_PATH);
    if (!existsSync(configuredCompiler)) {
      throw new Error(`WASI_SDK_PATH内にclangが見つかりません: ${configuredCompiler}`);
    }
    return configuredCompiler;
  }

  const { platform, architecture } = getPlatformTarget();
  const sdkName = `wasi-sdk-${WASI_SDK_VERSION}-${architecture}-${platform}`;
  const sdkDirectory = join(toolsDirectory, sdkName);
  const compiler = getCompilerPath(sdkDirectory);

  if (existsSync(compiler)) {
    return compiler;
  }

  const archive = join(toolsDirectory, `${sdkName}.tar.gz`);
  const downloadUrl =
    `https://github.com/WebAssembly/wasi-sdk/releases/download/` +
    `wasi-sdk-${WASI_SDK_RELEASE}/${sdkName}.tar.gz`;

  await mkdir(toolsDirectory, { recursive: true });
  console.log(`WASI SDK ${WASI_SDK_VERSION} をダウンロードしています...`);
  await downloadFile(downloadUrl, archive);

  try {
    run("tar", ["-xzf", archive, "-C", toolsDirectory]);
  } catch (error) {
    throw new Error(
      `WASI SDKを展開できませんでした。OS付属のtarを利用できるか確認してください。\n${error.message}`,
    );
  } finally {
    await rm(archive, { force: true });
  }

  if (!existsSync(compiler)) {
    throw new Error(`展開したWASI SDK内にclangが見つかりません: ${compiler}`);
  }

  return compiler;
}

const compiler = await findCompiler();
await mkdir(outputDirectory, { recursive: true });

run(compiler, [
  "--target=wasm32",
  "-std=c11",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-O3",
  "-nostdlib",
  "-Wl,--no-entry",
  "-Wl,--export=reset_allocator",
  "-Wl,--export=allocate",
  "-Wl,--export=process_image",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=131072",
  "-Wl,--max-memory=67108864",
  "-Wl,--strip-all",
  "-o",
  outputFile,
  sourceFile,
]);

console.log("C画像処理をコンパイルしました: public/wasm/image_processor.wasm");
