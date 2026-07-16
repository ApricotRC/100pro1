import { useEffect, useState } from "react";
import type { UserProfile } from "../types";

const STORAGE_KEY: string = "image-convert-draw-profile";

export const AVATAR_CHOICES: string[] = [
  "🎨",
  "🖌️",
  "✏️",
  "🐱",
  "🐶",
  "🐼",
  "🦊",
  "🐸",
  "🌸",
  "⭐",
  "🍩",
  "🚀",
];

function parseProfile(value: string | null): UserProfile | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const candidate: Partial<UserProfile> = parsed as Partial<UserProfile>;
    if (typeof candidate.name !== "string" || candidate.name.trim().length === 0) {
      return null;
    }
    return {
      name: candidate.name.trim().slice(0, 24),
      avatar:
        typeof candidate.avatar === "string" && candidate.avatar.length > 0
          ? candidate.avatar
          : AVATAR_CHOICES[0],
    };
  } catch {
    return null;
  }
}

export function useProfile(): [UserProfile | null, (profile: UserProfile) => void] {
  const [profile, setProfileState] = useState<UserProfile | null>(() =>
    parseProfile(window.localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    if (profile) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  }, [profile]);

  const setProfile = (next: UserProfile): void => {
    const name: string = next.name.trim().slice(0, 24);
    if (name.length === 0) {
      return;
    }
    setProfileState({ name, avatar: next.avatar || AVATAR_CHOICES[0] });
  };

  return [profile, setProfile];
}
