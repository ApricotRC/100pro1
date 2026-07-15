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
