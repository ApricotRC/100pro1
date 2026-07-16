import type { Post, UserProfile } from "../types";

const CLIENT_ID_KEY: string = "image-convert-draw-client-id";

export function getClientId(): string {
  const existing: string | null = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }
  const generated: string = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

const OFFLINE_MESSAGE: string =
  "サーバーに接続できません。npm run dev（または npm start）でサーバーが起動しているか確認してください。";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(OFFLINE_MESSAGE);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // JSONでないレスポンスはそのままエラー扱いにする。
  }

  if (!response.ok) {
    const message: string =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "サーバーでエラーが発生しました。";
    throw new Error(message);
  }

  return payload as T;
}

function jsonInit(method: string, body: object): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function fetchPosts(): Promise<Post[]> {
  const data = await request<{ posts: Post[] }>(
    `/api/posts?clientId=${encodeURIComponent(getClientId())}`,
  );
  return data.posts;
}

export async function createPost(
  imageDataUrl: string,
  caption: string,
  author: UserProfile,
): Promise<Post> {
  return request<Post>(
    "/api/posts",
    jsonInit("POST", {
      imageDataUrl,
      caption,
      author,
      clientId: getClientId(),
    }),
  );
}

export async function toggleLike(postId: string): Promise<Post> {
  return request<Post>(
    `/api/posts/${postId}/like`,
    jsonInit("POST", { clientId: getClientId() }),
  );
}

export async function addComment(
  postId: string,
  text: string,
  author: UserProfile,
): Promise<Post> {
  return request<Post>(
    `/api/posts/${postId}/comments`,
    jsonInit("POST", { text, author, clientId: getClientId() }),
  );
}

export async function deletePost(postId: string): Promise<void> {
  await request<{ ok: boolean }>(
    `/api/posts/${postId}`,
    jsonInit("DELETE", { clientId: getClientId() }),
  );
}
