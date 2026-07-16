import { useEffect } from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: ConfirmationModalProps): JSX.Element | null {
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">本当に完成させていい？</h2>
        <p id="confirm-description">
          完成した画像をPNGとして保存します。そのあと、タイムラインへの投稿もできます。
        </p>
        <div className="button-grid">
          <button type="button" className="secondary-button" onClick={onClose}>
            もうちょっと続ける
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            もう完成！
          </button>
        </div>
      </div>
    </div>
  );
}
