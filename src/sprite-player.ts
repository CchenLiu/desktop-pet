import type { PetAnimationAsset } from "./pet-skin";

type PlayOptions = {
  reduceMotion: boolean;
  size: number;
};

export class SpritePlayer {
  private animationFrame?: number;
  private generation = 0;
  private imageCache = new Map<string, Promise<HTMLImageElement>>();

  constructor(private readonly canvas: HTMLCanvasElement) {}

  stop() {
    this.generation += 1;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
  }

  async play(asset: PetAnimationAsset, options: PlayOptions) {
    this.stop();
    const generation = this.generation;
    const image = await this.load(asset.src);
    if (generation !== this.generation) return;

    const startedAt = performance.now();
    const render = (now: number) => {
      if (generation !== this.generation) return;
      const elapsedFrames = options.reduceMotion ? 0 : Math.floor(((now - startedAt) / 1000) * asset.fps);
      const frame = asset.loop ? elapsedFrames % asset.frames : Math.min(elapsedFrames, asset.frames - 1);
      this.draw(image, frame, asset, options.size);
      if (!options.reduceMotion && (asset.loop || elapsedFrames < asset.frames - 1)) {
        this.animationFrame = requestAnimationFrame(render);
      }
    };
    render(startedAt);
  }

  private load(src: string) {
    const cached = this.imageCache.get(src);
    if (cached) return cached;
    const pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load sprite sheet: ${src}`));
      image.src = src;
    });
    this.imageCache.set(src, pending);
    return pending;
  }

  private draw(image: HTMLImageElement, frame: number, asset: PetAnimationAsset, cssSize: number) {
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const outputSize = Math.round(cssSize * pixelRatio);
    if (this.canvas.width !== outputSize || this.canvas.height !== outputSize) {
      this.canvas.width = outputSize;
      this.canvas.height = outputSize;
    }

    const context = this.canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, outputSize, outputSize);

    const sourceFrameWidth = image.naturalWidth / asset.columns;
    const sourceFrameHeight = image.naturalHeight / asset.rows;
    const column = frame % asset.columns;
    const row = Math.floor(frame / asset.columns);
    const safeInset = 1;

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
  }
}
