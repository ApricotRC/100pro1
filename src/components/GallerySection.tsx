import type { GalleryItem } from "../types";

interface GallerySectionProps {
  items: GalleryItem[];
  isOpen: boolean;
  onToggle: () => void;
}

export function GallerySection({
  items,
  isOpen,
  onToggle,
}: GallerySectionProps): JSX.Element {
  return (
    <section className="panel-section" aria-labelledby="gallery-heading">
      <button
        type="button"
        className="primary-button full-width"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="gallery-panel"
      >
        きょうのギャラリーをみる
      </button>
      <div id="gallery-panel" hidden={!isOpen}>
        <div className="section-heading top-spaced">
          <h2 id="gallery-heading">ギャラリー</h2>
          <span className="section-note">最近の作品</span>
        </div>
        {items.length > 0 ? (
          <div className="gallery-grid">
            {items.map((item: GalleryItem) => (
              <article className="gallery-card" key={item.id}>
                <img
                  src={item.imageDataUrl}
                  alt={`保存作品 ${new Date(item.createdAt).toLocaleString("ja-JP")}`}
                  className="gallery-image"
                />
                <p className="gallery-date">
                  {new Date(item.createdAt).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="helper-text">まだ作品はありません。完成後にここへ保存されます。</p>
        )}
      </div>
    </section>
  );
}
