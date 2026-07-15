interface HeaderProps {
  onScrollToTutorial: () => void;
}

export function Header({ onScrollToTutorial }: HeaderProps): JSX.Element {
  return (
    <header className="panel-section header-section">
      <div>
        <p className="eyebrow">Image Convert & Draw</p>
        <h1>画像変換・お絵描きスタジオ</h1>
        <p className="section-copy">
          画像を読み込み、線画を作り、キャンバスで仕上げまで進められます。
        </p>
      </div>
      <button type="button" className="secondary-button" onClick={onScrollToTutorial}>
        使い方へ
      </button>
    </header>
  );
}
