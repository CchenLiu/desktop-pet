export type HydrationPlanInput = {
  target: number;
  completed: number;
  intervalMinutes: number;
  workStart: string;
  workEnd: string;
  now?: Date;
};

export type HydrationPlan = {
  totalSlots: number;
  remainingSlots: number;
  remainingAmount: number;
  recommendedAmount: number;
};

const parseClock = (value: string, fallback: number) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
};

const normalizedWindow = (workStart: string, workEnd: string) => {
  const start = parseClock(workStart, 9 * 60);
  const end = parseClock(workEnd, 18 * 60);
  return end > start ? { start, end } : { start: 9 * 60, end: 18 * 60 };
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const clockKey = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const buildHydrationPlan = ({
  target,
  completed,
  intervalMinutes,
  workStart,
  workEnd,
  now = new Date(),
}: HydrationPlanInput): HydrationPlan => {
  const { start, end } = normalizedWindow(workStart, workEnd);
  const interval = Math.max(15, Math.min(360, Math.round(intervalMinutes) || 60));
  const totalSlots = Math.max(1, Math.floor((end - start) / interval));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const firstRemainingIndex = nowMinutes <= start
    ? 1
    : Math.max(1, Math.ceil((nowMinutes - start) / interval));
  const remainingSlots = nowMinutes > end ? 0 : Math.max(0, totalSlots - firstRemainingIndex + 1);
  const remainingAmount = Math.max(0, Math.round(target) - Math.max(0, Math.round(completed)));
  const divisor = remainingSlots || totalSlots;
  const roundedRecommendation = Math.ceil((remainingAmount / divisor) / 10) * 10;
  const recommendedAmount = remainingAmount === 0 ? 0 : Math.min(remainingAmount, Math.max(10, roundedRecommendation));
  return { totalSlots, remainingSlots, remainingAmount, recommendedAmount };
};

export const intervalReminderSlotKey = (
  now: Date,
  workStart: string,
  workEnd: string,
  intervalMinutes: number,
) => {
  const { start, end } = normalizedWindow(workStart, workEnd);
  const interval = Math.max(15, Math.min(360, Math.round(intervalMinutes) || 60));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < start + interval || nowMinutes > end) return "";
  const slotIndex = Math.floor((nowMinutes - start) / interval);
  if (slotIndex < 1) return "";
  const slotMinutes = start + slotIndex * interval;
  return `${dateKey(now)}-${clockKey(slotMinutes)}`;
};
