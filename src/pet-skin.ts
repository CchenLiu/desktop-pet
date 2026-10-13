export type PetAction = "idle" | "touch" | "run" | "drink" | "feed" | "remind" | "happy";

export type AnimationFrameStep = {
  frame: number;
  durationMs: number;
};

export type PetAnimationAsset = {
  src: string;
  frames: number;
  columns: number;
  rows: number;
  fps: number;
  loop: boolean;
  frameMap?: number[];
  timeline?: AnimationFrameStep[];
  edgeCleanup?: "green-fringe";
};

export const animationDurationMs = (asset: PetAnimationAsset) => asset.timeline?.reduce(
  (total, step) => total + step.durationMs,
  0,
) ?? (asset.frames / asset.fps) * 1000;

export const animationFrameAt = (asset: PetAnimationAsset, elapsedMs: number) => {
  if (!asset.timeline?.length) {
    const elapsedFrames = Math.floor((Math.max(0, elapsedMs) / 1000) * asset.fps);
    return asset.loop ? elapsedFrames % asset.frames : Math.min(elapsedFrames, asset.frames - 1);
  }

  const durationMs = animationDurationMs(asset);
  const timelinePosition = asset.loop
    ? Math.max(0, elapsedMs) % durationMs
    : Math.min(Math.max(0, elapsedMs), Math.max(0, durationMs - 1));
  let cursor = 0;
  for (const step of asset.timeline) {
    cursor += step.durationMs;
    if (timelinePosition < cursor) return step.frame;
  }
  return asset.timeline[asset.timeline.length - 1].frame;
};

export type PetSkinManifest = {
  schemaVersion: 1;
  id: string;
  name: string;
  canvas: { width: number; height: number };
  anchor: { x: number; y: number };
  preview: string;
  animations: Partial<Record<PetAction, PetAnimationAsset>>;
};

export const validatePetSkinManifest = (value: unknown): value is PetSkinManifest => {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<PetSkinManifest>;
  return manifest.schemaVersion === 1
    && typeof manifest.id === "string"
    && typeof manifest.name === "string"
    && typeof manifest.preview === "string"
    && typeof manifest.canvas?.width === "number"
    && typeof manifest.canvas?.height === "number"
    && typeof manifest.anchor?.x === "number"
    && typeof manifest.anchor?.y === "number"
    && !!manifest.animations
    && typeof manifest.animations === "object";
};
