import type { UserProfile } from "../types";

interface HeaderProps {
  profile: UserProfile | null;
}

export function Header({ profile }: HeaderProps): JSX.Element {
  return (
    <header className="panel-section header-section">
      <div>
        <h1>おえかきスタジオSNS</h1>
        <p className="section-copy">
          画像から線画を作って色を塗り、みんなのタイムラインに投稿しよう。
        </p>
      </div>
      {profile ? (
        <div className="header-profile" title="マイページで変更できます">
          <span className="post-avatar" aria-hidden="true">
            {profile.avatar}
          </span>
          <span className="header-profile-name">{profile.name}</span>
        </div>
      ) : null}
    </header>
  );
}
