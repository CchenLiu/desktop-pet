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
  { frame: 0, durationMs: 4_200 },
  ...frames([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 190),
  { frame: 0, durationMs: 700 },
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
    idle: idleTimeline(),
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
