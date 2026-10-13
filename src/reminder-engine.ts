import type { Todo } from "./todo-store";

type RemindableTodo = Pick<Todo, "done" | "notified" | "remindAt">;
type IdentifiedRemindableTodo = RemindableTodo & Pick<Todo, "id">;

export const isTodoReminderDue = (todo: RemindableTodo, now = Date.now()) => {
  if (todo.done || todo.notified || !todo.remindAt) return false;
  const dueAt = new Date(todo.remindAt).getTime();
  return Number.isFinite(dueAt) && dueAt <= now;
};

export const findNextDueTodo = <T extends IdentifiedRemindableTodo>(todos: T[], now = Date.now()) => todos
  .filter((todo) => isTodoReminderDue(todo, now))
  .sort((left, right) => new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime())[0];

export const acknowledgeTodoReminder = <T extends IdentifiedRemindableTodo>(todos: T[], todoId: string) => {
  const todo = todos.find((item) => item.id === todoId);
  if (!todo || todo.done || todo.notified) return false;
  todo.notified = true;
  return true;
};

export const migrateTodoAcknowledgements = <T extends RemindableTodo>(todos: T[], lifecycleVersion: number) => lifecycleVersion >= 1
  ? todos
  : todos.map((todo) => todo.done || !todo.remindAt ? todo : { ...todo, notified: false });
