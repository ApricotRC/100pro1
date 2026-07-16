export type ToolMode = "pen" | "eraser" | "fill";

export interface GalleryItem {
  id: string;
  imageDataUrl: string;
  createdAt: string;
}

export interface DrawSettings {
  color: string;
  lineWidth: number;
  tool: ToolMode;
  lineCap: CanvasLineCap;
}

export interface UserProfile {
  name: string;
  avatar: string;
}

export interface PostComment {
  id: string;
  author: UserProfile;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  imageUrl: string;
  caption: string;
  author: UserProfile;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  mine: boolean;
  comments: PostComment[];
}
