import { useEffect, useState } from "react";
import type { GalleryItem } from "../types";

const STORAGE_KEY: string = "image-convert-draw-gallery";

function parseGalleryItems(value: string | null): GalleryItem[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item: unknown): item is GalleryItem => {
      if (typeof item !== "object" || item === null) {
        return false;
      }

      const candidate: Partial<GalleryItem> = item as Partial<GalleryItem>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.imageDataUrl === "string" &&
        typeof candidate.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

export function useLocalStorageGallery(): [
  GalleryItem[],
  (imageDataUrl: string) => void,
] {
  const [items, setItems] = useState<GalleryItem[]>(() =>
    parseGalleryItems(window.localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (imageDataUrl: string): void => {
    setItems((currentItems: GalleryItem[]) => {
      const nextItem: GalleryItem = {
        id: crypto.randomUUID(),
        imageDataUrl,
        createdAt: new Date().toISOString(),
      };

      return [nextItem, ...currentItems].slice(0, 12);
    });
  };

  return [items, addItem];
}
