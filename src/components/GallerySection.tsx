import type { GalleryItem } from "../types";

interface GallerySectionProps {
  items: GalleryItem[];
  onShare: (imageDataUrl: string) => void;
}

export function GallerySection({ items, onShare }: GallerySectionProps): JSX.Element {
  return (
    <section className="panel-section" aria-labelledby="gallery-heading">
      <div className="section-heading">
        <h2 id="gallery-heading">じぶんの作品</h2>
        <span className="section-note">この端末に保存された最近の作品</span>
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
              <div className="gallery-card-footer">
                <p className="gallery-date">
                  {new Date(item.createdAt).toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <button
                  type="button"
                  className="secondary-button gallery-share-button"
                  onClick={() => onShare(item.imageDataUrl)}
                >
                  投稿する
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="helper-text">
          まだ作品はありません。「つくる」タブで完成させるとここに保存されます。
        </p>
      )}
    </section>
  );
}
