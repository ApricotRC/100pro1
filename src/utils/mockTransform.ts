export interface TransformResult {
  transformedDataUrl: string;
  lineArtDataUrl: string;
  paletteColors: string[];
}

interface Color {
  r: number;
  g: number;
  b: number;
}

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

interface Point {
  x: number;
  y: number;
}

interface Component {
  cluster: number;
  cells: Point[];
}

const MAX_WORK_SIZE: number = 640;
const CLUSTER_COUNT: number = 8;
const KMEANS_ITERATIONS: number = 8;
const GRID_COLUMNS: number = 56;
const HIGHLIGHT_THRESHOLD: number = 226;
const SHADOW_THRESHOLD: number = 42;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function rgbToHsv(color: Color): HsvColor {
  const red: number = color.r / 255;
  const green: number = color.g / 255;
  const blue: number = color.b / 255;
  const max: number = Math.max(red, green, blue);
  const min: number = Math.min(red, green, blue);
  const delta: number = max - min;
  let hue: number = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function perceptualDistance(a: Color, b: Color): number {
  const hsvA: HsvColor = rgbToHsv(a);
  const hsvB: HsvColor = rgbToHsv(b);
  const hueDelta: number = Math.min(
    Math.abs(hsvA.h - hsvB.h),
    360 - Math.abs(hsvA.h - hsvB.h),
  ) / 180;
  const saturationDelta: number = hsvA.s - hsvB.s;
  const valueDelta: number = hsvA.v - hsvB.v;
  const redDelta: number = (a.r - b.r) / 255;
  const greenDelta: number = (a.g - b.g) / 255;
  const blueDelta: number = (a.b - b.b) / 255;

  return (
    hueDelta * hueDelta * 5.5 +
    saturationDelta * saturationDelta * 1.8 +
    valueDelta * valueDelta * 0.9 +
    (redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta) * 0.35
  );
}

function getPixel(data: Uint8ClampedArray, pixelIndex: number): Color {
  const offset: number = pixelIndex * 4;
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
  };
}

function getLuminance(color: Color): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function isHighlightOrShadow(color: Color): boolean {
  const luminance: number = getLuminance(color);
  const maxChannel: number = Math.max(color.r, color.g, color.b);
  const minChannel: number = Math.min(color.r, color.g, color.b);
  return luminance >= HIGHLIGHT_THRESHOLD || (luminance <= SHADOW_THRESHOLD && maxChannel - minChannel < 74);
}

function colorToCss(color: Color): string {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

function colorToHex(color: Color): string {
  const toHex = (value: number): string => Math.round(value).toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function getScale(width: number, height: number): number {
  const longestSide: number = Math.max(width, height);
  return longestSide > MAX_WORK_SIZE ? MAX_WORK_SIZE / longestSide : 1;
}

function drawBlurredImage(image: HTMLImageElement): HTMLCanvasElement {
  const scale: number = getScale(image.naturalWidth, image.naturalHeight);
  const width: number = Math.max(1, Math.round(image.naturalWidth * scale));
  const height: number = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas: HTMLCanvasElement = createCanvas(width, height);
  const originalCanvas: HTMLCanvasElement = createCanvas(width, height);
  const context: CanvasRenderingContext2D | null = canvas.getContext("2d");
  const originalContext: CanvasRenderingContext2D | null = originalCanvas.getContext("2d");

  if (!context || !originalContext) {
    throw new Error("Canvas initialization failed.");
  }

  originalContext.drawImage(image, 0, 0, width, height);
  context.filter = "blur(10px)";
  context.drawImage(image, 0, 0, width, height);
  context.filter = "none";

  const originalData: ImageData = originalContext.getImageData(0, 0, width, height);
  const blurredData: ImageData = context.getImageData(0, 0, width, height);
  const originalPixels: Uint8ClampedArray = originalData.data;
  const blurredPixels: Uint8ClampedArray = blurredData.data;

  for (let index: number = 0; index < originalPixels.length; index += 4) {
    const originalColor: Color = {
      r: originalPixels[index],
      g: originalPixels[index + 1],
      b: originalPixels[index + 2],
    };

    if (!isHighlightOrShadow(originalColor)) {
      continue;
    }

    const blurredColor: Color = {
      r: blurredPixels[index],
      g: blurredPixels[index + 1],
      b: blurredPixels[index + 2],
    };
    const originalLuminance: number = getLuminance(originalColor);
    const blurredLuminance: number = getLuminance(blurredColor);
    const contrastDelta: number = Math.abs(originalLuminance - blurredLuminance);

    if (contrastDelta < 18) {
      continue;
    }

    blurredPixels[index] = Math.round(originalColor.r * 0.82 + blurredColor.r * 0.18);
    blurredPixels[index + 1] = Math.round(originalColor.g * 0.82 + blurredColor.g * 0.18);
    blurredPixels[index + 2] = Math.round(originalColor.b * 0.82 + blurredColor.b * 0.18);
  }

  context.putImageData(blurredData, 0, 0);

  return canvas;
}

function initializeCentroids(samples: Color[], clusterCount: number): Color[] {
  if (samples.length === 0) {
    return [{ r: 255, g: 255, b: 255 }];
  }

  const centroids: Color[] = [];
  const sortedByLuminance: Color[] = [...samples].sort(
    (a: Color, b: Color) => getLuminance(a) - getLuminance(b),
  );
  centroids.push(sortedByLuminance[0], sortedByLuminance[sortedByLuminance.length - 1]);

  while (centroids.length < clusterCount) {
    let farthestSample: Color = samples[0];
    let farthestDistance: number = -1;

    for (const sample of samples) {
      const nearestDistance: number = Math.min(
        ...centroids.map((centroid: Color) => perceptualDistance(sample, centroid)),
      );

      if (nearestDistance > farthestDistance) {
        farthestDistance = nearestDistance;
        farthestSample = sample;
      }
    }

    centroids.push(farthestSample);
  }

  return centroids;
}

function quantizeColors(imageData: ImageData, clusterCount: number): {
  assignments: Uint8Array;
  palette: Color[];
} {
  const pixelCount: number = imageData.width * imageData.height;
  const data: Uint8ClampedArray = imageData.data;
  const sampleStep: number = Math.max(1, Math.floor(pixelCount / 9000));
  const samples: Color[] = [];

  for (let pixelIndex: number = 0; pixelIndex < pixelCount; pixelIndex += sampleStep) {
    samples.push(getPixel(data, pixelIndex));
  }

  let palette: Color[] = initializeCentroids(samples, clusterCount);
  const assignments: Uint8Array = new Uint8Array(pixelCount);

  for (let iteration: number = 0; iteration < KMEANS_ITERATIONS; iteration += 1) {
    const sums: Array<Color & { count: number }> = palette.map(() => ({
      r: 0,
      g: 0,
      b: 0,
      count: 0,
    }));

    for (let pixelIndex: number = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      const color: Color = getPixel(data, pixelIndex);
      let bestCluster: number = 0;
      let bestDistance: number = Number.POSITIVE_INFINITY;

      for (let cluster: number = 0; cluster < palette.length; cluster += 1) {
        const distance: number = perceptualDistance(color, palette[cluster]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = cluster;
        }
      }

      assignments[pixelIndex] = bestCluster;
      sums[bestCluster].r += color.r;
      sums[bestCluster].g += color.g;
      sums[bestCluster].b += color.b;
      sums[bestCluster].count += 1;
    }

    palette = sums.map((sum: Color & { count: number }, index: number) => {
      if (sum.count === 0) {
        return palette[index];
      }

      return {
        r: sum.r / sum.count,
        g: sum.g / sum.count,
        b: sum.b / sum.count,
      };
    });
  }

  return { assignments, palette };
}

function buildClusterGrid(
  assignments: Uint8Array,
  palette: Color[],
  imageWidth: number,
  imageHeight: number,
): {
  grid: Uint8Array;
  columns: number;
  rows: number;
  cellSize: number;
} {
  const cellSize: number = Math.max(8, Math.round(imageWidth / GRID_COLUMNS));
  const columns: number = Math.ceil(imageWidth / cellSize);
  const rows: number = Math.ceil(imageHeight / cellSize);
  const grid: Uint8Array = new Uint8Array(columns * rows);

  for (let row: number = 0; row < rows; row += 1) {
    for (let column: number = 0; column < columns; column += 1) {
      const counts: number[] = Array.from({ length: CLUSTER_COUNT }, () => 0);
      const startX: number = column * cellSize;
      const startY: number = row * cellSize;
      const endX: number = Math.min(startX + cellSize, imageWidth);
      const endY: number = Math.min(startY + cellSize, imageHeight);

      for (let y: number = startY; y < endY; y += 1) {
        for (let x: number = startX; x < endX; x += 1) {
          const pixelIndex: number = y * imageWidth + x;
          const cluster: number = assignments[pixelIndex];
          counts[cluster] += isHighlightOrShadow(palette[cluster]) ? 7 : 1;
        }
      }

      let bestCluster: number = 0;
      for (let cluster: number = 1; cluster < counts.length; cluster += 1) {
        if (counts[cluster] > counts[bestCluster]) {
          bestCluster = cluster;
        }
      }

      grid[row * columns + column] = bestCluster;
    }
  }

  return { grid, columns, rows, cellSize };
}

function extractComponents(grid: Uint8Array, columns: number, rows: number): Component[] {
  const visited: Uint8Array = new Uint8Array(grid.length);
  const components: Component[] = [];
  const directions: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  for (let row: number = 0; row < rows; row += 1) {
    for (let column: number = 0; column < columns; column += 1) {
      const index: number = row * columns + column;
      if (visited[index]) {
        continue;
      }

      const cluster: number = grid[index];
      const queue: Point[] = [{ x: column, y: row }];
      const cells: Point[] = [];
      visited[index] = 1;

      while (queue.length > 0) {
        const cell: Point = queue.shift() as Point;
        cells.push(cell);

        for (const direction of directions) {
          const nextX: number = cell.x + direction.x;
          const nextY: number = cell.y + direction.y;
          const nextIndex: number = nextY * columns + nextX;

          if (
            nextX < 0 ||
            nextY < 0 ||
            nextX >= columns ||
            nextY >= rows ||
            visited[nextIndex] ||
            grid[nextIndex] !== cluster
          ) {
            continue;
          }

          visited[nextIndex] = 1;
          queue.push({ x: nextX, y: nextY });
        }
      }

      components.push({ cluster, cells });
    }
  }

  return components;
}

function cross(origin: Point, a: Point, b: Point): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function convexHull(points: Point[]): Point[] {
  const uniquePoints: Point[] = Array.from(
    new Map(points.map((point: Point) => [`${point.x}:${point.y}`, point])).values(),
  ).sort((a: Point, b: Point) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  if (uniquePoints.length <= 3) {
    return uniquePoints;
  }

  const lower: Point[] = [];
  for (const point of uniquePoints) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: Point[] = [];
  for (let index: number = uniquePoints.length - 1; index >= 0; index -= 1) {
    const point: Point = uniquePoints[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx: number = end.x - start.x;
  const dy: number = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t: number = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  const projected: Point = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function simplifyLine(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance: number = 0;
  let splitIndex: number = 0;
  const start: Point = points[0];
  const end: Point = points[points.length - 1];

  for (let index: number = 1; index < points.length - 1; index += 1) {
    const distance: number = distanceToSegment(points[index], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= epsilon) {
    return [start, end];
  }

  return simplifyLine(points.slice(0, splitIndex + 1), epsilon).slice(0, -1).concat(
    simplifyLine(points.slice(splitIndex), epsilon),
  );
}

function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length <= 4) {
    return points;
  }

  const closed: Point[] = points.concat(points[0]);
  const simplified: Point[] = simplifyLine(closed, epsilon).slice(0, -1);
  return simplified.length >= 3 ? simplified : points.slice(0, 3);
}

function componentToPolygon(component: Component, cellSize: number): Point[] {
  const cornerPoints: Point[] = [];

  for (const cell of component.cells) {
    const left: number = cell.x * cellSize;
    const top: number = cell.y * cellSize;
    const right: number = left + cellSize;
    const bottom: number = top + cellSize;

    cornerPoints.push(
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    );
  }

  const hull: Point[] = convexHull(cornerPoints);
  return simplifyPolygon(hull, cellSize * 2.2);
}

function drawPolygon(context: CanvasRenderingContext2D, polygon: Point[], color: Color): void {
  if (polygon.length < 3) {
    return;
  }

  context.fillStyle = colorToCss(color);
  context.beginPath();
  context.moveTo(polygon[0].x, polygon[0].y);

  for (let index: number = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index].x, polygon[index].y);
  }

  context.closePath();
  context.fill();
}

function drawGeometricFlatImage(imageData: ImageData): {
  flatCanvas: HTMLCanvasElement;
  lineCanvas: HTMLCanvasElement;
  paletteColors: string[];
} {
  const { assignments, palette } = quantizeColors(imageData, CLUSTER_COUNT);
  const { grid, columns, rows, cellSize } = buildClusterGrid(
    assignments,
    palette,
    imageData.width,
    imageData.height,
  );
  const components: Component[] = extractComponents(grid, columns, rows).sort(
    (a: Component, b: Component) => b.cells.length - a.cells.length,
  );
  const flatCanvas: HTMLCanvasElement = createCanvas(imageData.width, imageData.height);
  const flatContext: CanvasRenderingContext2D | null = flatCanvas.getContext("2d");
  const lineCanvas: HTMLCanvasElement = createCanvas(imageData.width, imageData.height);
  const lineContext: CanvasRenderingContext2D | null = lineCanvas.getContext("2d");

  if (!flatContext || !lineContext) {
    throw new Error("Canvas initialization failed.");
  }

  const backgroundCluster: number = components[0]?.cluster ?? 0;
  flatContext.fillStyle = colorToCss(palette[backgroundCluster]);
  flatContext.fillRect(0, 0, imageData.width, imageData.height);
  lineContext.fillStyle = "#ffffff";
  lineContext.fillRect(0, 0, imageData.width, imageData.height);

  for (const component of components) {
    if (component.cells.length < 2 && !isHighlightOrShadow(palette[component.cluster])) {
      continue;
    }

    const polygon: Point[] = componentToPolygon(component, cellSize);
    if (polygon.length < 3) {
      continue;
    }

    drawPolygon(flatContext, polygon, palette[component.cluster]);

    lineContext.strokeStyle = "#1f1f1f";
    lineContext.lineWidth = Math.max(2, cellSize * 0.18);
    lineContext.lineJoin = "round";
    lineContext.beginPath();
    lineContext.moveTo(polygon[0].x, polygon[0].y);
    for (let index: number = 1; index < polygon.length; index += 1) {
      lineContext.lineTo(polygon[index].x, polygon[index].y);
    }
    lineContext.closePath();
    lineContext.stroke();
  }

  return {
    flatCanvas,
    lineCanvas,
    paletteColors: palette.map((color: Color) => colorToHex(color)),
  };
}

export async function mockTransformImage(sourceDataUrl: string): Promise<TransformResult> {
  return new Promise<TransformResult>((resolve, reject) => {
    const image: HTMLImageElement = new Image();

    image.onload = () => {
      try {
        const blurredCanvas: HTMLCanvasElement = drawBlurredImage(image);
        const context: CanvasRenderingContext2D | null = blurredCanvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas initialization failed."));
          return;
        }

        const imageData: ImageData = context.getImageData(
          0,
          0,
          blurredCanvas.width,
          blurredCanvas.height,
        );
        const { flatCanvas, lineCanvas, paletteColors } = drawGeometricFlatImage(imageData);

        window.setTimeout(() => {
          resolve({
            transformedDataUrl: flatCanvas.toDataURL("image/png"),
            lineArtDataUrl: lineCanvas.toDataURL("image/png"),
            paletteColors,
          });
        }, 2000);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Image transform failed."));
      }
    };

    image.onerror = () => reject(new Error("Image loading failed."));
    image.src = sourceDataUrl;
  });
}
