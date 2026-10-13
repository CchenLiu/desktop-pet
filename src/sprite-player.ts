import type { PetAnimationAsset } from "./pet-skin";

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
    const render = (now: number) => {
      if (generation !== this.generation) return;
      const elapsedFrames = options.reduceMotion ? 0 : Math.floor(((now - startedAt) / 1000) * asset.fps);
      const frame = asset.loop ? elapsedFrames % asset.frames : Math.min(elapsedFrames, asset.frames - 1);
      this.draw(image, frame, asset, options.size, options.flipX ?? false);
      if (!options.reduceMotion && (asset.loop || elapsedFrames < asset.frames - 1)) {
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
      image.onload = () => resolve(edgeCleanup === "green-fringe" ? this.cleanGreenFringe(image) : image);
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

  private draw(image: SpriteSheet, frame: number, asset: PetAnimationAsset, cssSize: number, flipX: boolean) {
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
    const sourceFrame = asset.frameMap?.[frame] ?? frame;
    const column = sourceFrame % asset.columns;
    const row = Math.floor(sourceFrame / asset.columns);
    const safeInset = 1;

    context.save();
    if (flipX) {
      context.translate(outputSize, 0);
      context.scale(-1, 1);
    }
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
    context.restore();
  }
}
