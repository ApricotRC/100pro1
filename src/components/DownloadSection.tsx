interface DownloadSectionProps {
  onDownloadLineArt: () => void;
  onDownloadImage: () => void;
  hasLineArt: boolean;
  hasImage: boolean;
}

export function DownloadSection({
  onDownloadLineArt,
  onDownloadImage,
  hasLineArt,
  hasImage,
}: DownloadSectionProps): JSX.Element {
  return (
    <section className="panel-section" aria-labelledby="download-heading">
      <div className="section-heading">
        <h2 id="download-heading">ダウンロード</h2>
      </div>
      <div className="button-grid">
        <button
          type="button"
          className="primary-button"
          onClick={onDownloadLineArt}
          disabled={!hasLineArt}
          title={!hasLineArt ? "線画を生成するとダウンロードできます" : undefined}
        >
          線画ダウンロード
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onDownloadImage}
          disabled={!hasImage}
          title={!hasImage ? "画像をアップロードするとダウンロードできます" : undefined}
        >
          画像ダウンロード
        </button>
      </div>
      {!hasLineArt ? <p className="helper-text">線画は変換後にダウンロードできます。</p> : null}
    </section>
  );
}
