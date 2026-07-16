interface TransformSectionProps {
  previewUrl: string | null;
  isTransforming: boolean;
  onTransform: () => void;
  canTransform: boolean;
}

export function TransformSection({
  previewUrl,
  isTransforming,
  onTransform,
  canTransform,
}: TransformSectionProps): JSX.Element {
  return (
    <section className="panel-section" aria-labelledby="transform-heading">
      <div className="section-heading">
        <h2 id="transform-heading">
          <span className="step-badge">2</span>線画に変換
        </h2>
        <span className="section-note">大きなプレビュー</span>
      </div>
      <div className="preview-card">
        {previewUrl ? (
          <img src={previewUrl} alt="変換対象または変換後の画像プレビュー" className="preview-image" />
        ) : (
          <div className="preview-placeholder">ここに画像プレビューが表示されます</div>
        )}
        {isTransforming ? (
          <div className="loading-overlay" aria-live="polite" aria-busy="true">
            <span>変換中…</span>
          </div>
        ) : null}
      </div>
      <button type="button" className="primary-button full-width" onClick={onTransform} disabled={!canTransform}>
        変換する！
      </button>
    </section>
  );
}
