import { FormEvent, useState } from "react";
import type { UserProfile } from "../types";
import { AVATAR_CHOICES } from "../hooks/useProfile";

interface ProfileSectionProps {
  profile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
}

export function ProfileSection({ profile, onSave }: ProfileSectionProps): JSX.Element {
  const [name, setName] = useState<string>(profile?.name ?? "");
  const [avatar, setAvatar] = useState<string>(profile?.avatar ?? AVATAR_CHOICES[0]);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (name.trim().length === 0) {
      return;
    }
    onSave({ name: name.trim(), avatar });
    setSavedMessage("プロフィールを保存しました。");
    window.setTimeout(() => setSavedMessage(null), 2500);
  };

  return (
    <section className="panel-section" aria-labelledby="profile-heading">
      <div className="section-heading">
        <h2 id="profile-heading">プロフィール</h2>
        <span className="section-note">投稿・コメントで表示されます</span>
      </div>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="profile-name">ニックネーム</label>
          <input
            id="profile-name"
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
        <button
          type="submit"
          className="primary-button full-width"
          disabled={name.trim().length === 0}
        >
          保存する
        </button>
        {savedMessage ? <p className="helper-text">{savedMessage}</p> : null}
        {!profile ? (
          <p className="helper-text">
            ニックネームを保存すると、タイムラインに投稿・コメントできるようになります。
          </p>
        ) : null}
      </form>
    </section>
  );
}
