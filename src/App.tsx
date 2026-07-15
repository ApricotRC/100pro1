import { ChangeEvent, useMemo, useRef, useState } from "react";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { DownloadSection } from "./components/DownloadSection";
import { DrawSection } from "./components/DrawSection";
import { GallerySection } from "./components/GallerySection";
import { Header } from "./components/Header";
import { TransformSection } from "./components/TransformSection";
import { TutorialSection } from "./components/TutorialSection";
import { UploadSection } from "./components/UploadSection";
import { useLocalStorageGallery } from "./hooks/useLocalStorageGallery";
import { transformImage } from "./utils/transformImage";

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const anchor: HTMLAnchorElement = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.click();
}

export default function App(): JSX.Element {
  const tutorialRef = useRef<HTMLElement | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [transformedImageUrl, setTransformedImageUrl] = useState<string | null>(null);
  const [lineArtUrl, setLineArtUrl] = useState<string | null>(null);
  const [transformPaletteColors, setTransformPaletteColors] = useState<string[]>([]);
  const [drawExportUrl, setDrawExportUrl] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState<boolean>(false);
  const [galleryOpen, setGalleryOpen] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [galleryItems, addGalleryItem] = useLocalStorageGallery();

  const activePreviewUrl: string | null = useMemo(() => {
    return transformedImageUrl ?? sourcePreviewUrl;
  }, [sourcePreviewUrl, transformedImageUrl]);

  const handleScrollToTutorial = (): void => {
    tutorialRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const loadImageFile = (file: File, label: string): void => {
    const acceptedTypes: string[] = ["image/jpeg", "image/png", "image/webp"];
    if (!acceptedTypes.includes(file.type)) {
      setErrorMessage("対応形式は jpg / jpeg / png / webp のみです。");
      return;
    }

    const reader: FileReader = new FileReader();
    reader.onload = () => {
      const result: string | ArrayBuffer | null = reader.result;
      if (typeof result !== "string") {
        setErrorMessage("画像の読み込みに失敗しました。");
        return;
      }

      setErrorMessage(null);
      setSourcePreviewUrl(result);
      setSourceFileName(label);
      setTransformedImageUrl(null);
      setLineArtUrl(null);
      setTransformPaletteColors([]);
      setDrawExportUrl(null);
    };
    reader.onerror = () => {
      setErrorMessage("画像ファイルを読み込めませんでした。");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file: File | undefined = event.target.files?.[0];
    if (!file) {
      return;
    }

    loadImageFile(file, file.name);
    event.target.value = "";
  };

  const handlePasteFromClipboard = async (): Promise<void> => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
      setErrorMessage("このブラウザではクリップボード画像の読み込みに対応していません。");
      return;
    }

    try {
      const clipboardItems: ClipboardItem[] = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType: string | undefined = item.types.find((type: string) =>
          ["image/jpeg", "image/png", "image/webp"].includes(type),
        );

        if (!imageType) {
          continue;
        }

        const blob: Blob = await item.getType(imageType);
        const extension: string = imageType.split("/")[1] ?? "png";
        const file: File = new File([blob], `clipboard-image.${extension}`, {
          type: imageType,
        });
        loadImageFile(file, "クリップボード画像");
        return;
      }

      setErrorMessage("クリップボードに対応画像が見つかりませんでした。");
    } catch {
      setErrorMessage("クリップボード画像を読み込めませんでした。ブラウザの許可を確認してください。");
    }
  };

  const handleTransform = async (): Promise<void> => {
    if (!sourcePreviewUrl || isTransforming) {
      return;
    }

    setErrorMessage(null);
    setIsTransforming(true);
    try {
      const result = await transformImage(sourcePreviewUrl);
      setTransformedImageUrl(result.transformedDataUrl);
      setLineArtUrl(result.lineArtDataUrl);
      setTransformPaletteColors(result.paletteColors);
    } catch (error) {
      const message: string =
        error instanceof Error ? error.message : "変換処理でエラーが発生しました。";
      setErrorMessage(message);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleDownloadLineArt = (): void => {
    if (!lineArtUrl) {
      return;
    }
    downloadDataUrl(lineArtUrl, "line-art.png");
  };

  const handleDownloadImage = (): void => {
    if (!activePreviewUrl) {
      return;
    }
    downloadDataUrl(activePreviewUrl, "current-image.png");
  };

  const handleConfirmFinish = (): void => {
    if (!drawExportUrl) {
      setErrorMessage("保存するキャンバス画像がありません。");
      setIsConfirmOpen(false);
      return;
    }

    addGalleryItem(drawExportUrl);
    downloadDataUrl(drawExportUrl, "finished-artwork.png");
    setGalleryOpen(true);
    setIsConfirmOpen(false);
  };

  return (
    <div className="page-shell">
      <main className="app-panel">
        <Header onScrollToTutorial={handleScrollToTutorial} />
        <UploadSection
          fileName={sourceFileName}
          previewUrl={sourcePreviewUrl}
          errorMessage={errorMessage}
          onFileChange={handleFileChange}
          onPasteFromClipboard={handlePasteFromClipboard}
        />
        <TransformSection
          previewUrl={activePreviewUrl}
          isTransforming={isTransforming}
          onTransform={handleTransform}
          canTransform={Boolean(sourcePreviewUrl) && !isTransforming}
        />
        <DownloadSection
          onDownloadLineArt={handleDownloadLineArt}
          onDownloadImage={handleDownloadImage}
          hasLineArt={Boolean(lineArtUrl)}
          hasImage={Boolean(activePreviewUrl)}
        />
        <DrawSection
          baseImageUrl={lineArtUrl}
          colorPalette={transformPaletteColors}
          onExportReady={setDrawExportUrl}
        />
        <section className="panel-section" aria-labelledby="finish-heading">
          <div className="section-heading">
            <h2 id="finish-heading">完成確認</h2>
          </div>
          <button
            type="button"
            className="primary-button full-width"
            onClick={() => setIsConfirmOpen(true)}
            disabled={!drawExportUrl}
          >
            完成！
          </button>
        </section>
        <GallerySection items={galleryItems} isOpen={galleryOpen} onToggle={() => setGalleryOpen((current) => !current)} />
        <section ref={tutorialRef}>
          <TutorialSection />
        </section>
      </main>
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmFinish}
      />
    </div>
  );
}
