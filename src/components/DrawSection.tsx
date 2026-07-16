import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DrawSettings, ToolMode } from "../types";

interface DrawSectionProps {
  baseImageUrl: string | null;
  colorPalette: string[];
  onExportReady: (exportDataUrl: string | null) => void;
}

interface Point {
  x: number;
  y: number;
}

interface CanvasSize {
  displayWidth: number;
  displayHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}

const DEFAULT_RATIO: number = 4 / 3;
const FILL_TOLERANCE: number = 36;

function hexToRgb(hex: string): [number, number, number] {
  const normalized: string = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function colorsMatch(data: Uint8ClampedArray, offset: number, target: [number, number, number]): boolean {
  return (
    Math.abs(data[offset] - target[0]) <= FILL_TOLERANCE &&
    Math.abs(data[offset + 1] - target[1]) <= FILL_TOLERANCE &&
    Math.abs(data[offset + 2] - target[2]) <= FILL_TOLERANCE
  );
}

export function DrawSection({
  baseImageUrl,
  colorPalette,
  onExportReady,
}: DrawSectionProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingStateRef = useRef<boolean>(false);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const savedCanvasDataRef = useRef<string | null>(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState<boolean>(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(true);
  const [settings, setSettings] = useState<DrawSettings>({
    color: "#0f6b67",
    lineWidth: 8,
    tool: "pen",
    lineCap: "round",
  });
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    displayWidth: 320,
    displayHeight: 240,
    pixelWidth: 320,
    pixelHeight: 240,
  });
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("線画の上から描けます。");

  const syncUndoState = useCallback((): void => {
    setCanUndo(historyRef.current.length > 1);
    setCanRedo(redoRef.current.length > 0);
  }, []);

  const getContext = useCallback((): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext("2d") ?? null;
  }, []);

  const publishCanvas = useCallback((): void => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) {
      onExportReady(null);
      return;
    }

    const dataUrl: string = canvas.toDataURL("image/png");
    savedCanvasDataRef.current = dataUrl;
    onExportReady(dataUrl);
  }, [onExportReady]);

  const saveSnapshot = useCallback((): void => {
    const context: CanvasRenderingContext2D | null = getContext();
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!context || !canvas) {
      return;
    }

    historyRef.current.push(context.getImageData(0, 0, canvas.width, canvas.height));
    if (historyRef.current.length > 25) {
      historyRef.current.shift();
    }
    redoRef.current = [];
    syncUndoState();
    publishCanvas();
  }, [getContext, publishCanvas, syncUndoState]);

  const calculateSize = useCallback(async (dataUrl: string | null): Promise<CanvasSize> => {
    const wrapper: HTMLDivElement | null = wrapperRef.current;
    const displayWidth: number = Math.max(280, Math.min((wrapper?.clientWidth ?? 360) - 2, 380));
    const ratio: number = await new Promise<number>((resolve) => {
      if (!dataUrl) {
        resolve(DEFAULT_RATIO);
        return;
      }

      const image: HTMLImageElement = new Image();
      image.onload = () => resolve(image.naturalHeight / image.naturalWidth);
      image.onerror = () => resolve(DEFAULT_RATIO);
      image.src = dataUrl;
    });
    const displayHeight: number = Math.max(160, Math.round(displayWidth * ratio));
    const dpr: number = window.devicePixelRatio || 1;

    return {
      displayWidth,
      displayHeight,
      pixelWidth: Math.round(displayWidth * dpr),
      pixelHeight: Math.round(displayHeight * dpr),
    };
  }, []);

  const redrawFromDataUrl = useCallback(
    async (dataUrl: string | null, resetHistory: boolean): Promise<void> => {
      const canvas: HTMLCanvasElement | null = canvasRef.current;
      if (!canvas) {
        return;
      }

      const nextSize: CanvasSize = await calculateSize(dataUrl);
      setCanvasSize(nextSize);
      canvas.style.width = `${nextSize.displayWidth}px`;
      canvas.style.height = `${nextSize.displayHeight}px`;
      canvas.width = nextSize.pixelWidth;
      canvas.height = nextSize.pixelHeight;

      const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
      if (!context) {
        return;
      }

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      const finish = (): void => {
        if (resetHistory) {
          historyRef.current = [context.getImageData(0, 0, canvas.width, canvas.height)];
          redoRef.current = [];
          syncUndoState();
        }
        publishCanvas();
      };

      if (!dataUrl) {
        finish();
        return;
      }

      const image: HTMLImageElement = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        finish();
      };
      image.onerror = () => {
        setStatusMessage("画像の再表示に失敗しました。");
        finish();
      };
      image.src = dataUrl;
    },
    [calculateSize, publishCanvas, syncUndoState],
  );

  useEffect(() => {
    savedCanvasDataRef.current = null;
    if (isCanvasOpen) {
      void redrawFromDataUrl(baseImageUrl, true);
    }
  }, [baseImageUrl, redrawFromDataUrl]);

  useEffect(() => {
    if (!isCanvasOpen) {
      return;
    }

    const handleResize = (): void => {
      const dataUrl: string | null = canvasRef.current?.toDataURL("image/png") ?? savedCanvasDataRef.current;
      void redrawFromDataUrl(dataUrl, false);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [isCanvasOpen, redrawFromDataUrl]);

  useEffect(() => {
    if (isCanvasOpen) {
      const dataUrl: string | null = savedCanvasDataRef.current ?? baseImageUrl;
      void redrawFromDataUrl(dataUrl, !savedCanvasDataRef.current);
    }
  }, [baseImageUrl, isCanvasOpen, redrawFromDataUrl]);

  const getPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect: DOMRect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((event.clientX - rect.left) * (canvas.width / rect.width)),
      y: Math.floor((event.clientY - rect.top) * (canvas.height / rect.height)),
    };
  }, []);

  const configureContext = useCallback((): CanvasRenderingContext2D | null => {
    const context: CanvasRenderingContext2D | null = getContext();
    const dpr: number = window.devicePixelRatio || 1;
    if (!context) {
      return null;
    }

    context.lineCap = settings.lineCap;
    context.lineJoin = "round";
    context.lineWidth = settings.lineWidth * dpr;
    context.strokeStyle = settings.color;
    context.globalCompositeOperation =
      settings.tool === "eraser" ? "destination-out" : "source-over";
    return context;
  }, [getContext, settings.color, settings.lineCap, settings.lineWidth, settings.tool]);

  const fillAtPoint = useCallback(
    (point: Point): void => {
      const context: CanvasRenderingContext2D | null = getContext();
      const canvas: HTMLCanvasElement | null = canvasRef.current;
      if (!context || !canvas) {
        return;
      }

      const imageData: ImageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;
      const startX: number = Math.max(0, Math.min(canvas.width - 1, point.x));
      const startY: number = Math.max(0, Math.min(canvas.height - 1, point.y));
      const startOffset: number = (startY * canvas.width + startX) * 4;
      const target: [number, number, number] = [
        data[startOffset],
        data[startOffset + 1],
        data[startOffset + 2],
      ];
      const fillColor: [number, number, number] = hexToRgb(settings.color);

      if (colorsMatch(data, startOffset, fillColor)) {
        return;
      }

      const visited: Uint8Array = new Uint8Array(canvas.width * canvas.height);
      const queue: Point[] = [{ x: startX, y: startY }];
      visited[startY * canvas.width + startX] = 1;

      while (queue.length > 0) {
        const current: Point = queue.pop() as Point;
        const offset: number = (current.y * canvas.width + current.x) * 4;

        if (!colorsMatch(data, offset, target)) {
          continue;
        }

        data[offset] = fillColor[0];
        data[offset + 1] = fillColor[1];
        data[offset + 2] = fillColor[2];
        data[offset + 3] = 255;

        const neighbors: Point[] = [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 },
        ];

        for (const neighbor of neighbors) {
          if (
            neighbor.x < 0 ||
            neighbor.y < 0 ||
            neighbor.x >= canvas.width ||
            neighbor.y >= canvas.height
          ) {
            continue;
          }

          const neighborIndex: number = neighbor.y * canvas.width + neighbor.x;
          if (visited[neighborIndex]) {
            continue;
          }

          visited[neighborIndex] = 1;
          queue.push(neighbor);
        }
      }

      context.putImageData(imageData, 0, 0);
      saveSnapshot();
    },
    [getContext, saveSnapshot, settings.color],
  );

  const beginStroke = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const canvas: HTMLCanvasElement | null = canvasRef.current;
      const context: CanvasRenderingContext2D | null = configureContext();
      if (!canvas || !context) {
        return;
      }

      event.preventDefault();
      const point: Point = getPoint(event);

      if (settings.tool === "fill") {
        fillAtPoint(point);
        return;
      }

      drawingStateRef.current = true;
      pointerIdRef.current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      lastPointRef.current = point;
      context.beginPath();
      context.moveTo(point.x, point.y);
    },
    [configureContext, fillAtPoint, getPoint, settings.tool],
  );

  const continueStroke = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const context: CanvasRenderingContext2D | null = configureContext();
      if (!drawingStateRef.current || !context || pointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const point: Point = getPoint(event);
      if (!lastPointRef.current) {
        lastPointRef.current = point;
      }

      context.beginPath();
      context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      lastPointRef.current = point;
      publishCanvas();
    },
    [configureContext, getPoint, publishCanvas],
  );

  const endStroke = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>): void => {
      const canvas: HTMLCanvasElement | null = canvasRef.current;
      if (!drawingStateRef.current || pointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();
      drawingStateRef.current = false;
      pointerIdRef.current = null;
      lastPointRef.current = null;
      canvas?.releasePointerCapture(event.pointerId);
      saveSnapshot();
    },
    [saveSnapshot],
  );

  const handleUndo = useCallback((): void => {
    const context: CanvasRenderingContext2D | null = getContext();
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!context || !canvas || historyRef.current.length <= 1) {
      return;
    }

    const current: ImageData | undefined = historyRef.current.pop();
    if (current) {
      redoRef.current.push(current);
    }

    const previous: ImageData | undefined = historyRef.current[historyRef.current.length - 1];
    if (previous) {
      context.putImageData(previous, 0, 0);
      publishCanvas();
    }
    syncUndoState();
  }, [getContext, publishCanvas, syncUndoState]);

  const handleRedo = useCallback((): void => {
    const context: CanvasRenderingContext2D | null = getContext();
    const next: ImageData | undefined = redoRef.current.pop();
    if (!context || !next) {
      return;
    }

    context.putImageData(next, 0, 0);
    historyRef.current.push(next);
    publishCanvas();
    syncUndoState();
  }, [getContext, publishCanvas, syncUndoState]);

  const handleRestoreImage = useCallback((): void => {
    void redrawFromDataUrl(baseImageUrl, true);
  }, [baseImageUrl, redrawFromDataUrl]);

  const handleClear = useCallback((): void => {
    void redrawFromDataUrl(null, true);
  }, [redrawFromDataUrl]);

  const setTool = (tool: ToolMode): void => {
    setSettings((current: DrawSettings) => ({
      ...current,
      tool,
    }));
  };

  return (
    <section className="panel-section" aria-labelledby="draw-heading">
      <div className="section-heading">
        <h2 id="draw-heading">
          <span className="step-badge">3</span>色をぬる
        </h2>
        <span className="section-note">指でもペンでも描けます</span>
      </div>
      <div className="toolbar-row">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setIsPaletteOpen((current: boolean) => !current)}
          aria-expanded={isPaletteOpen}
        >
          パレット
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => setIsCanvasOpen((current: boolean) => !current)}
          aria-expanded={isCanvasOpen}
        >
          {isCanvasOpen ? "キャンバスをとじる" : "キャンバスをひらく"}
        </button>
      </div>
      {isCanvasOpen ? (
        <div className="draw-layout">
          {isPaletteOpen ? (
            <aside className="palette-panel palette-panel-top" aria-label="描画パレット">
              <div className="field-group">
                <label htmlFor="brush-color">線の色</label>
                <input
                  id="brush-color"
                  type="color"
                  value={settings.color}
                  onChange={(event) =>
                    setSettings((current: DrawSettings) => ({
                      ...current,
                      color: event.target.value,
                    }))
                  }
                />
                {colorPalette.length > 0 ? (
                  <div className="color-swatch-grid" aria-label="変換画像の色パレット">
                    {colorPalette.map((color: string) => (
                      <button
                        type="button"
                        className={`color-swatch${settings.color === color ? " is-selected" : ""}`}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setSettings((current: DrawSettings) => ({
                            ...current,
                            color,
                          }))
                        }
                        aria-label={`${color} を線の色にする`}
                        title={color}
                        key={color}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mini-helper">変換後に画像内の色が表示されます。</p>
                )}
              </div>
              <div className="field-group">
                <label htmlFor="brush-size">筆の形・サイズ</label>
                <input
                  id="brush-size"
                  type="range"
                  min="2"
                  max="28"
                  step="1"
                  value={settings.lineWidth}
                  onChange={(event) =>
                    setSettings((current: DrawSettings) => ({
                      ...current,
                      lineWidth: Number(event.target.value),
                    }))
                  }
                />
                <select
                  aria-label="筆の形"
                  value={settings.lineCap}
                  onChange={(event) =>
                    setSettings((current: DrawSettings) => ({
                      ...current,
                      lineCap: event.target.value as CanvasLineCap,
                    }))
                  }
                >
                  <option value="round">丸筆</option>
                  <option value="square">角筆</option>
                  <option value="butt">フラット</option>
                </select>
              </div>
              <div className="field-group">
                <span>ツール</span>
                <div className="tool-grid">
                  <button
                    type="button"
                    className={settings.tool === "pen" ? "primary-button" : "secondary-button"}
                    onClick={() => setTool("pen")}
                  >
                    ペン
                  </button>
                  <button
                    type="button"
                    className={settings.tool === "eraser" ? "primary-button" : "secondary-button"}
                    onClick={() => setTool("eraser")}
                  >
                    消しゴム
                  </button>
                  <button
                    type="button"
                    className={settings.tool === "fill" ? "primary-button" : "secondary-button"}
                    onClick={() => setTool("fill")}
                  >
                    塗りつぶし
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
          <div className="canvas-block" ref={wrapperRef}>
            <canvas
              ref={canvasRef}
              className="draw-canvas"
              width={canvasSize.pixelWidth}
              height={canvasSize.pixelHeight}
              onPointerDown={beginStroke}
              onPointerMove={continueStroke}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
              onPointerLeave={endStroke}
            />
            <p className="helper-text">{statusMessage}</p>
          </div>
        </div>
      ) : (
        <p className="helper-text">キャンバスをひらくと描画を再開できます。</p>
      )}
      <div className="button-grid top-spaced">
        <button type="button" className="secondary-button" onClick={handleUndo} disabled={!canUndo}>
          元に戻す
        </button>
        <button type="button" className="secondary-button" onClick={handleRedo} disabled={!canRedo}>
          やり直す
        </button>
        <button type="button" className="secondary-button" onClick={handleRestoreImage} disabled={!baseImageUrl}>
          画像を表示しなおす
        </button>
        <button type="button" className="secondary-button" onClick={handleClear}>
          全消去
        </button>
      </div>
    </section>
  );
}
