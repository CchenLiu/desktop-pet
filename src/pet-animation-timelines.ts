export type AnimationTimelineStep = {
  frame: number;
  durationMs: number;
};

type ActionTimeline = Record<string, AnimationTimelineStep[]>;

const frames = (values: number[], durationMs: number): AnimationTimelineStep[] => (
  values.map((frame) => ({ frame, durationMs }))
);

const repeat = (values: number[], count: number, durationMs: number): AnimationTimelineStep[] => (
  Array.from({ length: count }, () => frames(values, durationMs)).flat()
);

const drinkTimeline = (): AnimationTimelineStep[] => [
  ...frames([0, 1, 2, 3], 100),
  ...repeat([4, 5, 6, 7, 6, 5], 4, 100),
  ...frames([8, 9, 10, 11, 12, 13, 14, 15], 90),
];

const idleTimeline = (): AnimationTimelineStep[] => [
  ...frames([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 150),
  { frame: 0, durationMs: 600 },
];

const shepherdIdleTimeline = (): AnimationTimelineStep[] => [
  { frame: 0, durationMs: 360 },
  ...frames([1, 2, 3], 170),
  ...frames([4, 5, 6, 7], 190),
  { frame: 8, durationMs: 220 },
  { frame: 9, durationMs: 360 },
  { frame: 10, durationMs: 220 },
  { frame: 11, durationMs: 180 },
  ...frames([12, 13], 170),
  ...repeat([14, 15], 3, 140),
  { frame: 0, durationMs: 500 },
];

export const petActionTimelines: Record<string, ActionTimeline> = {
  alaskan: {
    idle: idleTimeline(),
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3, 4, 5, 6, 7], 120),
      ...repeat([8, 9, 10, 9], 2, 180),
      ...frames([11, 12, 13, 14, 15], 150),
    ],
  },
  shepherd: {
    idle: shepherdIdleTimeline(),
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3, 4, 5, 6], 120),
      ...repeat([7, 8, 9, 8], 2, 180),
      ...frames([10, 11, 12, 13, 14, 15], 130),
    ],
  },
  siamese: {
    idle: idleTimeline(),
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3, 4], 130),
      ...repeat([4, 5, 6, 5], 2, 190),
      ...frames([7, 8, 9, 10, 11, 12, 13, 14, 15], 110),
    ],
  },
  "maine-coon": {
    idle: idleTimeline(),
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3, 4], 130),
      ...repeat([4, 5, 6, 5], 2, 190),
      ...frames([7, 8, 9, 10, 11, 12, 13, 14, 15], 110),
    ],
  },
};
