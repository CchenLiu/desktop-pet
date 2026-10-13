import type { Todo } from "./todo-store";

type RemindableTodo = Pick<Todo, "done" | "notified" | "remindAt">;

export const isTodoReminderDue = (todo: RemindableTodo, now = Date.now()) => {
  if (todo.done || todo.notified || !todo.remindAt) return false;
  const dueAt = new Date(todo.remindAt).getTime();
  return Number.isFinite(dueAt) && dueAt <= now;
};
