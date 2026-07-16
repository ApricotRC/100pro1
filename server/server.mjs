// 作品共有SNS用の軽量APIサーバー。
// Node.js 標準機能（node:http / node:fs / node:crypto）のみで実装し、
// 追加の npm ライブラリには依存しない。
// データは server/data/posts.json と server/data/images/ に保存する。

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const IMAGES_DIR = join(DATA_DIR, "images");
const POSTS_FILE = join(DATA_DIR, "posts.json");
const DIST_DIR = resolve(__dirname, "..", "dist");

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_POSTS = 200;
const MAX_TEXT = 300;
const MAX_NAME = 24;
const MAX_AVATAR = 8;
const MAX_COMMENTS_PER_POST = 100;

/** @type {Array<object>} 新しい投稿が先頭 */
let posts = [];

async function loadPosts() {
  try {
    const raw = await readFile(POSTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      posts = parsed;
    }
  } catch {
    posts = [];
  }
}

let saveQueue = Promise.resolve();

function savePosts() {
  // 書き込みを直列化し、一時ファイル経由で破損を防ぐ。
  saveQueue = saveQueue.then(async () => {
    const tmpFile = `${POSTS_FILE}.tmp`;
    await writeFile(tmpFile, JSON.stringify(posts, null, 2), "utf8");
    await rename(tmpFile, POSTS_FILE);
  });
  return saveQueue;
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }
  return trimmed;
}

function sanitizeAuthor(value) {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const name = sanitizeText(value.name, MAX_NAME);
  const avatar = sanitizeText(value.avatar, MAX_AVATAR) ?? "🎨";
  if (!name) {
    return null;
  }
  return { name, avatar };
}

function toPublicPost(post, clientId) {
  return {
    id: post.id,
    imageUrl: `/api/images/${post.imageFile}`,
    caption: post.caption,
    author: post.author,
    createdAt: post.createdAt,
    likeCount: post.likes.length,
    likedByMe: Boolean(clientId) && post.likes.includes(clientId),
    mine: Boolean(clientId) && post.ownerClientId === clientId,
    comments: post.comments,
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function readBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        rejectPromise(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks)));
    req.on("error", rejectPromise);
  });
}

async function readJsonBody(req) {
  const buffer = await readBody(req);
  return JSON.parse(buffer.toString("utf8"));
}

const IMAGE_DATA_URL_PATTERN = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

async function handleCreatePost(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendError(res, 400, "リクエストの読み込みに失敗しました。");
    return;
  }

  const caption = sanitizeText(body.caption, MAX_TEXT) ?? "";
  const author = sanitizeAuthor(body.author);
  const clientId = sanitizeText(body.clientId, 64);
  if (!author || !clientId) {
    sendError(res, 400, "投稿者情報が正しくありません。");
    return;
  }

  const match =
    typeof body.imageDataUrl === "string"
      ? body.imageDataUrl.match(IMAGE_DATA_URL_PATTERN)
      : null;
  if (!match) {
    sendError(res, 400, "画像データが正しくありません（PNGのみ対応）。");
    return;
  }

  const imageBuffer = Buffer.from(match[1], "base64");
  const postId = randomUUID();
  const imageFile = `${postId}.png`;
  await writeFile(join(IMAGES_DIR, imageFile), imageBuffer);

  const post = {
    id: postId,
    imageFile,
    caption,
    author,
    ownerClientId: clientId,
    createdAt: new Date().toISOString(),
    likes: [],
    comments: [],
  };

  posts.unshift(post);
  const removed = posts.slice(MAX_POSTS);
  posts = posts.slice(0, MAX_POSTS);
  for (const oldPost of removed) {
    unlink(join(IMAGES_DIR, oldPost.imageFile)).catch(() => {});
  }
  await savePosts();
  sendJson(res, 201, toPublicPost(post, clientId));
}

async function handleToggleLike(req, res, postId) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendError(res, 400, "リクエストの読み込みに失敗しました。");
    return;
  }

  const clientId = sanitizeText(body.clientId, 64);
  if (!clientId) {
    sendError(res, 400, "clientId が必要です。");
    return;
  }

  const post = posts.find((item) => item.id === postId);
  if (!post) {
    sendError(res, 404, "投稿が見つかりません。");
    return;
  }

  if (post.likes.includes(clientId)) {
    post.likes = post.likes.filter((id) => id !== clientId);
  } else {
    post.likes.push(clientId);
  }
  await savePosts();
  sendJson(res, 200, toPublicPost(post, clientId));
}

async function handleAddComment(req, res, postId) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendError(res, 400, "リクエストの読み込みに失敗しました。");
    return;
  }

  const text = sanitizeText(body.text, MAX_TEXT);
  const author = sanitizeAuthor(body.author);
  const clientId = sanitizeText(body.clientId, 64);
  if (!text || !author) {
    sendError(res, 400, "コメント内容が正しくありません。");
    return;
  }

  const post = posts.find((item) => item.id === postId);
  if (!post) {
    sendError(res, 404, "投稿が見つかりません。");
    return;
  }
  if (post.comments.length >= MAX_COMMENTS_PER_POST) {
    sendError(res, 400, "この投稿にはこれ以上コメントできません。");
    return;
  }

  post.comments.push({
    id: randomUUID(),
    author,
    text,
    createdAt: new Date().toISOString(),
  });
  await savePosts();
  sendJson(res, 201, toPublicPost(post, clientId));
}

async function handleDeletePost(req, res, postId) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    body = {};
  }

  const clientId = sanitizeText(body.clientId, 64);
  const post = posts.find((item) => item.id === postId);
  if (!post) {
    sendError(res, 404, "投稿が見つかりません。");
    return;
  }
  if (!clientId || post.ownerClientId !== clientId) {
    sendError(res, 403, "自分の投稿だけ削除できます。");
    return;
  }

  posts = posts.filter((item) => item.id !== postId);
  unlink(join(IMAGES_DIR, post.imageFile)).catch(() => {});
  await savePosts();
  sendJson(res, 200, { ok: true });
}

const IMAGE_FILE_PATTERN = /^[a-f0-9-]+\.png$/;

async function handleGetImage(res, fileName) {
  if (!IMAGE_FILE_PATTERN.test(fileName)) {
    sendError(res, 400, "不正なファイル名です。");
    return;
  }

  try {
    const buffer = await readFile(join(IMAGES_DIR, fileName));
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    res.end(buffer);
  } catch {
    sendError(res, 404, "画像が見つかりません。");
  }
}

const STATIC_MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

async function handleStatic(res, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = normalize(join(DIST_DIR, relativePath));
  if (!filePath.startsWith(DIST_DIR)) {
    sendError(res, 403, "アクセスできません。");
    return;
  }

  try {
    const buffer = await readFile(filePath);
    const mime = STATIC_MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(buffer);
  } catch {
    // SPA なので不明なパスは index.html を返す。
    try {
      const buffer = await readFile(join(DIST_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buffer);
    } catch {
      sendError(res, 404, "ビルド済みアプリが見つかりません。npm run build を実行してください。");
    }
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = url.pathname;
  const method = req.method ?? "GET";

  if (pathname === "/api/posts" && method === "GET") {
    const clientId = url.searchParams.get("clientId");
    sendJson(res, 200, {
      posts: posts.map((post) => toPublicPost(post, clientId)),
    });
    return;
  }

  if (pathname === "/api/posts" && method === "POST") {
    await handleCreatePost(req, res);
    return;
  }

  const likeMatch = pathname.match(/^\/api\/posts\/([a-f0-9-]+)\/like$/);
  if (likeMatch && method === "POST") {
    await handleToggleLike(req, res, likeMatch[1]);
    return;
  }

  const commentMatch = pathname.match(/^\/api\/posts\/([a-f0-9-]+)\/comments$/);
  if (commentMatch && method === "POST") {
    await handleAddComment(req, res, commentMatch[1]);
    return;
  }

  const postMatch = pathname.match(/^\/api\/posts\/([a-f0-9-]+)$/);
  if (postMatch && method === "DELETE") {
    await handleDeletePost(req, res, postMatch[1]);
    return;
  }

  const imageMatch = pathname.match(/^\/api\/images\/([^/]+)$/);
  if (imageMatch && method === "GET") {
    await handleGetImage(res, imageMatch[1]);
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendError(res, 404, "APIが見つかりません。");
    return;
  }

  if (method === "GET" && existsSync(DIST_DIR)) {
    await handleStatic(res, pathname);
    return;
  }

  sendError(res, 404, "Not Found");
}

await mkdir(IMAGES_DIR, { recursive: true });
await loadPosts();

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      sendError(res, 500, "サーバーエラーが発生しました。");
    } else {
      res.end();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[sns-server] http://localhost:${PORT} で起動しました`);
  if (existsSync(DIST_DIR)) {
    console.log("[sns-server] dist/ を配信します（本番モード）");
  } else {
    console.log("[sns-server] APIのみ提供します（開発時は npm run dev から利用）");
  }
});
