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

export const petActionTimelines: Record<string, ActionTimeline> = {
  alaskan: {
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3, 4, 5], 100),
      ...repeat([6, 7, 6, 8], 4, 110),
      ...frames([9, 10, 11, 12, 13, 14, 15], 100),
    ],
  },
  shepherd: {
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3, 4, 5], 100),
      ...repeat([5, 6, 5, 7], 4, 110),
      ...frames([8, 9, 10, 11, 12, 13, 14, 15], 100),
    ],
  },
  siamese: {
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3], 100),
      ...repeat([3, 4, 3, 5], 4, 110),
      ...frames([6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 90),
    ],
  },
  "maine-coon": {
    drink: drinkTimeline(),
    feed: [
      ...frames([0, 1, 2, 3], 100),
      ...repeat([4, 5, 6, 5], 4, 110),
      ...frames([7, 8, 9, 10, 11, 12, 13, 14, 15], 90),
    ],
  },
};
