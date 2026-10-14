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
  blendFrames?: boolean;
  frameMap?: number[];
  timeline?: AnimationFrameStep[];
  edgeCleanup?: "green-fringe" | "generated-fringe";
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

export type AnimationFrameSample = {
  frame: number;
  nextFrame: number;
  blend: number;
};

const smoothBlend = (progress: number) => {
  const transition = Math.max(0, Math.min(1, (progress - 0.55) / 0.45));
  return transition * transition * (3 - 2 * transition);
};

export const animationFrameSampleAt = (asset: PetAnimationAsset, elapsedMs: number): AnimationFrameSample => {
  const frame = animationFrameAt(asset, elapsedMs);
  if (!asset.blendFrames) return { frame, nextFrame: frame, blend: 0 };

  if (!asset.timeline?.length) {
    const exactFrame = (Math.max(0, elapsedMs) / 1000) * asset.fps;
    const frameIndex = Math.floor(exactFrame);
    const nextFrame = asset.loop
      ? (frameIndex + 1) % asset.frames
      : Math.min(frameIndex + 1, asset.frames - 1);
    return { frame, nextFrame, blend: smoothBlend(exactFrame - frameIndex) };
  }

  const durationMs = animationDurationMs(asset);
  const timelinePosition = asset.loop
    ? Math.max(0, elapsedMs) % durationMs
    : Math.min(Math.max(0, elapsedMs), Math.max(0, durationMs - 1));
  let cursor = 0;
  for (let index = 0; index < asset.timeline.length; index += 1) {
    const step = asset.timeline[index];
    const stepStart = cursor;
    cursor += step.durationMs;
    if (timelinePosition >= cursor) continue;
    const nextStep = asset.timeline[index + 1] ?? (asset.loop ? asset.timeline[0] : step);
    const progress = (timelinePosition - stepStart) / step.durationMs;
    return { frame: step.frame, nextFrame: nextStep.frame, blend: smoothBlend(progress) };
  }
  return { frame, nextFrame: frame, blend: 0 };
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
