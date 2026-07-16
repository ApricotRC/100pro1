import { FormEvent, useEffect, useState } from "react";
import type { Post, UserProfile } from "../types";
import { AVATAR_CHOICES } from "../hooks/useProfile";
import { createPost } from "../utils/api";

interface PostModalProps {
  isOpen: boolean;
  imageDataUrl: string | null;
  profile: UserProfile | null;
  onSaveProfile: (profile: UserProfile) => void;
  onClose: () => void;
  onPosted: (post: Post) => void;
}

export function PostModal({
  isOpen,
  imageDataUrl,
  profile,
  onSaveProfile,
  onClose,
  onPosted,
}: PostModalProps): JSX.Element | null {
  const [caption, setCaption] = useState<string>("");
  const [name, setName] = useState<string>(profile?.name ?? "");
  const [avatar, setAvatar] = useState<string>(profile?.avatar ?? AVATAR_CHOICES[0]);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCaption("");
      setErrorMessage(null);
      setName(profile?.name ?? "");
      setAvatar(profile?.avatar ?? AVATAR_CHOICES[0]);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageDataUrl) {
    return null;
  }

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const trimmedName: string = name.trim();
    if (trimmedName.length === 0 || isPosting) {
      return;
    }

    const author: UserProfile = { name: trimmedName, avatar };
    setIsPosting(true);
    setErrorMessage(null);
    try {
      const post: Post = await createPost(imageDataUrl, caption.trim(), author);
      onSaveProfile(author);
      onPosted(post);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "投稿に失敗しました。");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card post-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="post-modal-title">タイムラインに投稿</h2>
        <img src={imageDataUrl} alt="投稿する作品のプレビュー" className="post-modal-preview" />
        <form className="profile-form" onSubmit={handleSubmit}>
          {!profile ? (
            <>
              <div className="field-group">
                <label htmlFor="post-name">ニックネーム</label>
                <input
                  id="post-name"
                  type="text"
                  value={name}
                  maxLength={24}
                  placeholder="例: そうた"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="field-group">
                <span>アイコン</span>
                <div className="avatar-grid" role="radiogroup" aria-label="アイコンを選択">
                  {AVATAR_CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={avatar === choice}
                      className={avatar === choice ? "avatar-choice is-selected" : "avatar-choice"}
                      onClick={() => setAvatar(choice)}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="helper-text">
              {avatar} {name} として投稿します（マイページで変更できます）
            </p>
          )}
          <div className="field-group">
            <label htmlFor="post-caption">ひとこと（任意）</label>
            <textarea
              id="post-caption"
              value={caption}
              maxLength={300}
              rows={3}
              placeholder="作品の説明やコメントをどうぞ"
              onChange={(event) => setCaption(event.target.value)}
            />
          </div>
          {errorMessage ? (
            <p className="error-text" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="button-grid">
            <button type="button" className="secondary-button" onClick={onClose}>
              やめておく
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isPosting || name.trim().length === 0}
            >
              {isPosting ? "投稿中…" : "投稿する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
