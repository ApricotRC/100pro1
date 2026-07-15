export interface TransformResult {
  transformedDataUrl: string;
  lineArtDataUrl: string;
  paletteColors: string[];
}

interface ImageProcessorExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  reset_allocator: () => void;
  allocate: (size: number) => number;
  process_image: (
    inputPointer: number,
    flatOutputPointer: number,
    lineOutputPointer: number,
    palettePointer: number,
    width: number,
    height: number,
  ) => number;
}

const MAX_WORK_SIZE: number = 640;
const PALETTE_COLOR_COUNT: number = 8;

let processorPromise: Promise<ImageProcessorExports> | null = null;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(sourceDataUrl: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image: HTMLImageElement = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    image.src = sourceDataUrl;
  });
}

async function loadProcessor(): Promise<ImageProcessorExports> {
  if (!processorPromise) {
    processorPromise = (async () => {
      const wasmUrl: URL = new URL("wasm/image_processor.wasm", document.baseURI);
      const response: Response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(
          "C画像処理モジュールを読み込めませんでした。先に ./setup.sh を実行してください。",
        );
      }

      const bytes: ArrayBuffer = await response.arrayBuffer();
      const result: WebAssembly.WebAssemblyInstantiatedSource = await WebAssembly.instantiate(bytes, {});
      const exports: WebAssembly.Exports = result.instance.exports;

      if (
        !(exports.memory instanceof WebAssembly.Memory) ||
        typeof exports.reset_allocator !== "function" ||
        typeof exports.allocate !== "function" ||
        typeof exports.process_image !== "function"
      ) {
        throw new Error("C画像処理モジュールの形式が正しくありません。");
      }

      return exports as ImageProcessorExports;
    })().catch((error: unknown) => {
      processorPromise = null;
      throw error;
    });
  }

  return processorPromise;
}

function imageDataToDataUrl(imageData: ImageData): string {
  const canvas: HTMLCanvasElement = createCanvas(imageData.width, imageData.height);
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvasを初期化できませんでした。");
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function pixelsToImageData(pixels: Uint8Array, width: number, height: number): ImageData {
  const imageData: ImageData = new ImageData(width, height);
  imageData.data.set(pixels);
  return imageData;
}

function toHex(red: number, green: number, blue: number): string {
  const channelToHex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`;
}

export async function transformImage(sourceDataUrl: string): Promise<TransformResult> {
  const [image, processor]: [HTMLImageElement, ImageProcessorExports] = await Promise.all([
    loadImage(sourceDataUrl),
    loadProcessor(),
  ]);
  const scale: number = Math.min(1, MAX_WORK_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width: number = Math.max(1, Math.round(image.naturalWidth * scale));
  const height: number = Math.max(1, Math.round(image.naturalHeight * scale));
  const sourceCanvas: HTMLCanvasElement = createCanvas(width, height);
  const sourceContext: CanvasRenderingContext2D | null = sourceCanvas.getContext("2d");

  if (!sourceContext) {
    throw new Error("Canvasを初期化できませんでした。");
  }

  sourceContext.drawImage(image, 0, 0, width, height);
  const sourceImageData: ImageData = sourceContext.getImageData(0, 0, width, height);
  const imageByteLength: number = sourceImageData.data.byteLength;
  const paletteByteLength: number = PALETTE_COLOR_COUNT * 4;

  processor.reset_allocator();
  const inputPointer: number = processor.allocate(imageByteLength);
  const flatOutputPointer: number = processor.allocate(imageByteLength);
  const lineOutputPointer: number = processor.allocate(imageByteLength);
  const palettePointer: number = processor.allocate(paletteByteLength);

  if (!inputPointer || !flatOutputPointer || !lineOutputPointer || !palettePointer) {
    throw new Error("C画像処理用のメモリを確保できませんでした。");
  }

  new Uint8Array(processor.memory.buffer, inputPointer, imageByteLength).set(sourceImageData.data);
  const status: number = processor.process_image(
    inputPointer,
    flatOutputPointer,
    lineOutputPointer,
    palettePointer,
    width,
    height,
  );

  if (status !== 0) {
    throw new Error(`C画像処理でエラーが発生しました（code: ${status}）。`);
  }

  const flatPixels: Uint8Array = new Uint8Array(
    processor.memory.buffer,
    flatOutputPointer,
    imageByteLength,
  );
  const linePixels: Uint8Array = new Uint8Array(
    processor.memory.buffer,
    lineOutputPointer,
    imageByteLength,
  );
  const paletteBytes: Uint8Array = new Uint8Array(
    processor.memory.buffer,
    palettePointer,
    paletteByteLength,
  );
  const paletteColors: string[] = [];

  for (let index: number = 0; index < PALETTE_COLOR_COUNT; index += 1) {
    const offset: number = index * 4;
    paletteColors.push(toHex(paletteBytes[offset], paletteBytes[offset + 1], paletteBytes[offset + 2]));
  }

  return {
    transformedDataUrl: imageDataToDataUrl(pixelsToImageData(flatPixels, width, height)),
    lineArtDataUrl: imageDataToDataUrl(pixelsToImageData(linePixels, width, height)),
    paletteColors,
  };
}
