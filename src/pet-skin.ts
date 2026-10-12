export type PetAction = "idle" | "touch" | "drag" | "drink" | "feed" | "remind" | "happy";

export type PetAnimationAsset = {
  src: string;
  frames: number;
  columns: number;
  rows: number;
  fps: number;
  loop: boolean;
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
