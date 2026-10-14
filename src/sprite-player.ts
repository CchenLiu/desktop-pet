import { animationDurationMs, animationFrameSampleAt, type PetAnimationAsset } from "./pet-skin";

type PlayOptions = {
  reduceMotion: boolean;
  size: number;
  flipX?: boolean;
};

type SpriteSheet = HTMLImageElement | HTMLCanvasElement;

export class SpritePlayer {
  private animationFrame?: number;
  private generation = 0;
  private imageCache = new Map<string, Promise<SpriteSheet>>();

  constructor(private readonly canvas: HTMLCanvasElement) {}

  stop() {
    this.generation += 1;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
  }

  async preload(assets: PetAnimationAsset[]) {
    const sources = new Map(assets.map((asset) => [asset.src, asset]));
    await Promise.allSettled([...sources.values()].map((asset) => this.load(asset.src, asset.edgeCleanup)));
  }

  async play(asset: PetAnimationAsset, options: PlayOptions) {
    this.stop();
    const generation = this.generation;
    const image = await this.load(asset.src, asset.edgeCleanup);
    if (generation !== this.generation) return;

    const startedAt = performance.now();
    const durationMs = animationDurationMs(asset);
    const render = (now: number) => {
      if (generation !== this.generation) return;
      const elapsedMs = options.reduceMotion ? 0 : now - startedAt;
      const sample = animationFrameSampleAt(asset, elapsedMs);
      this.draw(image, sample.frame, asset, options.size, options.flipX ?? false, sample.nextFrame, sample.blend);
      if (!options.reduceMotion && (asset.loop || elapsedMs < durationMs)) {
        this.animationFrame = requestAnimationFrame(render);
      }
    };
    render(startedAt);
  }

  private load(src: string, edgeCleanup?: PetAnimationAsset["edgeCleanup"]) {
    const cached = this.imageCache.get(src);
    if (cached) return cached;
    const pending = new Promise<SpriteSheet>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(
        edgeCleanup === "green-fringe"
          ? this.cleanGreenFringe(image)
          : edgeCleanup === "generated-fringe"
            ? this.cleanGeneratedFringe(image)
            : image,
      );
      image.onerror = () => reject(new Error(`Unable to load sprite sheet: ${src}`));
      image.src = src;
    });
    this.imageCache.set(src, pending);
    return pending;
  }

  private cleanGreenFringe(image: HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return image;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = pixels;
    const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const offset = (y * width + x) * 4;
        const alpha = data[offset + 3];
        if (alpha === 0) continue;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const touchesTransparency = alphaAt(x - 1, y) < 24 || alphaAt(x + 1, y) < 24
          || alphaAt(x, y - 1) < 24 || alphaAt(x, y + 1) < 24;
        if (touchesTransparency && green > red * 1.08 && green > blue * 1.08) {
          data[offset + 1] = Math.max(red, blue);
          if (alpha < 112) data[offset + 3] = Math.round(alpha * 0.72);
        }
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  }

  private cleanGeneratedFringe(image: HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return image;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = pixels;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] === 0) continue;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const neonRed = red > 225 && green < 95 && blue < 95;
      const neonYellow = red > 225 && green > 175 && blue < 85;
      const neonGreen = green > 215 && red < 135 && blue < 135;
      if (neonRed || neonYellow || neonGreen) data[offset + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  }

  private draw(
    image: SpriteSheet,
    frame: number,
    asset: PetAnimationAsset,
    cssSize: number,
    flipX: boolean,
    nextFrame = frame,
    blend = 0,
  ) {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const outputSize = Math.round(cssSize * pixelRatio);
    if (this.canvas.width !== outputSize || this.canvas.height !== outputSize) {
      this.canvas.width = outputSize;
      this.canvas.height = outputSize;
    }

    const context = this.canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, outputSize, outputSize);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
    const sourceFrameWidth = sourceWidth / asset.columns;
    const sourceFrameHeight = sourceHeight / asset.rows;
    const safeInset = 1;

    context.save();
    if (flipX) {
      context.translate(outputSize, 0);
      context.scale(-1, 1);
    }
    const drawFrame = (targetFrame: number, opacity: number) => {
      const sourceFrame = asset.frameMap?.[targetFrame] ?? targetFrame;
      const column = sourceFrame % asset.columns;
      const row = Math.floor(sourceFrame / asset.columns);
      context.globalAlpha = opacity;
      context.drawImage(
        image,
        column * sourceFrameWidth + safeInset,
        row * sourceFrameHeight + safeInset,
        sourceFrameWidth - safeInset * 2,
        sourceFrameHeight - safeInset * 2,
        0,
        0,
        outputSize,
        outputSize,
      );
    };
    drawFrame(frame, 1);
    if (nextFrame !== frame && blend > 0) drawFrame(nextFrame, blend);
    context.restore();
  }
}
