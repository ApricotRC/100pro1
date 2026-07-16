import { ChangeEvent, useMemo } from "react";

interface UploadSectionProps {
  fileName: string | null;
  previewUrl: string | null;
  errorMessage: string | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPasteFromClipboard: () => void;
}

export function UploadSection({
  fileName,
  previewUrl,
  errorMessage,
  onFileChange,
  onPasteFromClipboard,
}: UploadSectionProps): JSX.Element {
  const helperText: string = useMemo(() => {
    if (fileName) {
      return `選択中: ${fileName}`;
    }

    return "jpg / jpeg / png / webp に対応しています。";
  }, [fileName]);

  return (
    <section className="panel-section" aria-labelledby="upload-heading">
      <div className="section-heading">
        <h2 id="upload-heading">
          <span className="step-badge">1</span>画像をえらぶ
        </h2>
        <span className="section-note">アップロードして準備</span>
      </div>
      <div className="upload-row">
        <div className="thumbnail-frame">
          {previewUrl ? (
            <img src={previewUrl} alt="アップロード画像のサムネイル" className="thumbnail-image" />
          ) : (
            <div className="thumbnail-placeholder" aria-hidden="true">
              No Image
            </div>
          )}
        </div>
        <div className="upload-actions">
          <label className="primary-button file-button">
            アップロード
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={onFileChange}
            />
          </label>
          <button type="button" className="secondary-button" onClick={onPasteFromClipboard}>
            貼り付け
          </button>
          <label className="secondary-button file-button camera-button">
            カメラ
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
            />
          </label>
        </div>
      </div>
      <p className="helper-text">{helperText}</p>
      {errorMessage ? (
        <p className="error-text" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
