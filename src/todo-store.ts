export type TodoPriority = "normal" | "important" | "urgent";

export type Todo = {
  id: string;
  title: string;
  remindAt: string;
  priority: TodoPriority;
  done: boolean;
  notified: boolean;
};

export const todoEventName = "todos-updated";

const stateKeys = ["desktop-pet-state-v3", "desktop-pet-state-v2", "desktop-pet-state-v1"];

export const normalizeTodo = (todo: Partial<Todo>): Todo => ({
  id: todo.id ?? crypto.randomUUID(),
  title: String(todo.title ?? ""),
  remindAt: String(todo.remindAt ?? ""),
  priority: todo.priority === "important" || todo.priority === "urgent" ? todo.priority : "normal",
  done: Boolean(todo.done),
  notified: Boolean(todo.notified),
});

export const loadTodos = (): Todo[] => {
  for (const key of stateKeys) {
    try {
      const state = JSON.parse(localStorage.getItem(key) ?? "null") as { todos?: Partial<Todo>[] } | null;
      if (state?.todos) return state.todos.map(normalizeTodo);
    } catch {
      // Continue with the next compatible state key.
    }
  }
  return [];
};

export const saveTodos = (todos: Todo[]) => {
  const stateKey = stateKeys[0];
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(localStorage.getItem(stateKey) ?? "{}") as Record<string, unknown>;
  } catch {
    // A valid current-state object will be recreated below.
  }
  localStorage.setItem(stateKey, JSON.stringify({ ...state, todos }));
};
